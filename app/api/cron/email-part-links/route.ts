import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import nodemailer from 'nodemailer';
import { extractPartNumberCandidates } from '@/lib/email-part-number-extraction';
import {
  renderPartLinksHtml,
  renderPartLinksText,
  resolvePartNumberLinks,
} from '@/lib/email-part-links';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROCESSED_FLAG = 'OrbitPartLinksProcessed';
const DEFAULT_RECIPIENT = 'rfq@orbit-surplus.com';

type MailboxConfig = {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  recipient: string;
  startAt: Date;
};

function positivePort(
  rawValue: string | undefined,
  fallback: number,
): number {
  const parsed = Number(rawValue);

  return Number.isInteger(parsed) && parsed > 0 && parsed < 65_536
    ? parsed
    : fallback;
}

function getMailboxConfig(): MailboxConfig | null {
  const smtpHost = process.env.MXROUTE_SMTP_HOST?.trim() || '';
  const smtpUser = process.env.MXROUTE_SMTP_USER?.trim() || '';
  const smtpPass = process.env.MXROUTE_SMTP_PASS || '';
  const imapHost =
    process.env.MXROUTE_IMAP_HOST?.trim() || smtpHost;
  const explicitImapUser =
    process.env.MXROUTE_IMAP_USER?.trim() || '';
  const imapUser = explicitImapUser || smtpUser;
  const imapPass = process.env.MXROUTE_IMAP_PASS || smtpPass;
  const recipient =
    process.env.ORBIT_PART_LINKS_RECIPIENT?.trim() ||
    DEFAULT_RECIPIENT;
  const rawStartAt =
    process.env.ORBIT_PART_LINKS_START_AT?.trim() || '';
  const startAt = new Date(rawStartAt);

  if (
    !smtpHost ||
    !smtpUser ||
    !smtpPass ||
    !imapHost ||
    !imapUser ||
    !imapPass ||
    !rawStartAt ||
    Number.isNaN(startAt.getTime()) ||
    (!explicitImapUser &&
      imapUser.toLowerCase() !== recipient.toLowerCase())
  ) {
    return null;
  }

  return {
    imapHost,
    imapPort: positivePort(process.env.MXROUTE_IMAP_PORT, 993),
    imapUser,
    imapPass,
    smtpHost,
    smtpPort: positivePort(process.env.MXROUTE_SMTP_PORT, 465),
    smtpUser,
    smtpPass,
    recipient,
    startAt,
  };
}

function getHeaderValue(
  message: ParsedMail,
  headerName: string,
): string {
  const value = message.headers.get(headerName.toLowerCase());

  if (Array.isArray(value)) {
    return value.join(' ');
  }

  return typeof value === 'string' ? value : '';
}

function isAutomatedLinkMessage(message: ParsedMail): boolean {
  if (getHeaderValue(message, 'x-orbit-part-links') === '1') {
    return true;
  }

  const autoSubmitted = getHeaderValue(
    message,
    'auto-submitted',
  ).toLowerCase();

  return Boolean(autoSubmitted && autoSubmitted !== 'no');
}

function getReplyAddress(message: ParsedMail): string | undefined {
  return (
    message.replyTo?.value.find((entry) => entry.address)?.address ||
    message.from?.value.find((entry) => entry.address)?.address ||
    undefined
  );
}

function getReplySubject(subject: string | undefined): string {
  const cleanSubject = (subject || 'Customer RFQ')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  return /^re\s*:/i.test(cleanSubject)
    ? cleanSubject
    : `Re: ${cleanSubject}`;
}

function getReferences(message: ParsedMail): string[] | undefined {
  const references = Array.isArray(message.references)
    ? message.references
    : message.references
      ? [message.references]
      : [];

  if (message.messageId) {
    references.push(message.messageId);
  }

  return references.length > 0
    ? Array.from(new Set(references))
    : undefined;
}

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim() || '';

  return Boolean(
    cronSecret &&
      req.headers.get('authorization') === `Bearer ${cronSecret}`,
  );
}

async function markProcessed(
  client: ImapFlow,
  uid: number,
): Promise<void> {
  await client.messageFlagsAdd(
    uid,
    [PROCESSED_FLAG],
    { uid: true },
  );
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getMailboxConfig();

  if (!config) {
    console.error('Email part-link mailbox configuration is incomplete');

    return Response.json(
      { error: 'Mailbox configuration is incomplete' },
      { status: 503 },
    );
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';
  const maxMessages = Math.min(
    10,
    Math.max(
      1,
      Number(process.env.ORBIT_PART_LINKS_BATCH_SIZE) || 5,
    ),
  );
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: true,
    auth: {
      user: config.imapUser,
      pass: config.imapPass,
    },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 45_000,
    maxLiteralSize: 30 * 1024 * 1024,
    maxResponseSize: 31 * 1024 * 1024,
  });
  client.on('error', (error) => {
    console.error('Email part-link IMAP connection error:', error.message);
  });

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  let lock: Awaited<ReturnType<ImapFlow['getMailboxLock']>> | null =
    null;
  let scanned = 0;
  let linked = 0;
  let skipped = 0;

  try {
    await client.connect();
    lock = await client.getMailboxLock('INBOX');

    const searchResult = await client.search(
      {
        since: config.startAt,
        unKeyword: PROCESSED_FLAG,
      },
      { uid: true },
    );
    const candidateUids = Array.isArray(searchResult)
      ? searchResult
          .sort((left, right) => left - right)
          .slice(-maxMessages)
      : [];

    for (const uid of candidateUids) {
      const fetched = await client.fetchOne(
        String(uid),
        {
          source: true,
          internalDate: true,
        },
        { uid: true },
      );

      if (!fetched || !fetched.source) {
        continue;
      }

      const internalDate = new Date(fetched.internalDate || 0);

      if (
        !Number.isNaN(internalDate.getTime()) &&
        internalDate < config.startAt
      ) {
        if (!dryRun) {
          await markProcessed(client, uid);
        }
        skipped += 1;
        continue;
      }

      scanned += 1;
      const message = await simpleParser(fetched.source, {
        skipImageLinks: true,
        maxHtmlLengthToParse: 2_000_000,
      });

      if (isAutomatedLinkMessage(message)) {
        if (!dryRun) {
          await markProcessed(client, uid);
        }
        skipped += 1;
        continue;
      }

      const candidates = extractPartNumberCandidates(
        `${message.subject || ''}\n${message.text || ''}`,
      );
      const links = await resolvePartNumberLinks(candidates);

      if (links.length === 0) {
        if (!dryRun) {
          await markProcessed(client, uid);
        }
        skipped += 1;
        continue;
      }

      if (!dryRun) {
        await transporter.sendMail({
          from: `"Orbit Part Links" <${config.smtpUser}>`,
          to: config.recipient,
          replyTo: getReplyAddress(message),
          subject: getReplySubject(message.subject),
          inReplyTo: message.messageId,
          references: getReferences(message),
          headers: {
            'X-Orbit-Part-Links': '1',
            'Auto-Submitted': 'auto-generated',
            'X-Auto-Response-Suppress': 'All',
          },
          html: renderPartLinksHtml(links),
          text: renderPartLinksText(links),
        });
        await markProcessed(client, uid);
      }

      linked += 1;
    }

    return Response.json({
      success: true,
      dryRun,
      scanned,
      linked,
      skipped,
    });
  } catch (error) {
    console.error(
      'Email part-link processing failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );

    return Response.json(
      { error: 'Unable to process mailbox' },
      { status: 500 },
    );
  } finally {
    lock?.release();

    if (client.usable) {
      try {
        await client.logout();
      } catch {
        client.close();
      }
    } else {
      client.close();
    }
  }
}
