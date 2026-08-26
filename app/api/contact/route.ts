import nodemailer from 'nodemailer';
import {
  checkPublicFormRateLimit,
  cleanFormText,
  escapeHtml,
  isValidEmail,
} from '@/lib/public-form-security';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rateLimit = checkPublicFormRateLimit(req, 'contact');

  if (!rateLimit.allowed) {
    return Response.json(
      {
        success: false,
        error: 'Too many requests. Please try again later.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const smtpHost = process.env.MXROUTE_SMTP_HOST;
  const smtpUser = process.env.MXROUTE_SMTP_USER;
  const smtpPass = process.env.MXROUTE_SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error('ORBIT CONTROL CONTACT SMTP CONFIGURATION IS MISSING');

    return Response.json(
      {
        success: false,
        error: 'The contact service is temporarily unavailable. Please try again later.',
      },
      { status: 500 }
    );
  }

  try {
    let body: Record<string, unknown>;

    try {
      const parsedBody: unknown = await req.json();

      if (!parsedBody || typeof parsedBody !== 'object') {
        throw new Error('Invalid JSON body');
      }

      body = parsedBody as Record<string, unknown>;
    } catch {
      return Response.json(
        {
          success: false,
          error: 'A valid JSON request body is required.',
        },
        { status: 400 },
      );
    }

    if (cleanFormText(body.website, 200)) {
      return Response.json({ success: true });
    }

    const data = {
      name: cleanFormText(body.name, 120),
      company: cleanFormText(body.company, 160),
      email: cleanFormText(body.email, 254),
      phone: cleanFormText(body.phone, 80),
      subject: cleanFormText(body.subject, 180).replace(
        /[\r\n]+/g,
        ' ',
      ),
      message: cleanFormText(body.message, 5000),
    };

    if (
      !data.name ||
      !isValidEmail(data.email) ||
      !data.message
    ) {
      return Response.json(
        {
          success: false,
          error: 'Please provide a valid name, email, and message.',
        },
        { status: 400 },
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `"Orbit Control Contact" <${smtpUser}>`,
      to: 'info@orbit-surplus.com',
      replyTo: data.email,
      subject: `Orbit Control Contact - ${data.subject || 'New Message'}`,
      html: `
        <h2>New Orbit Control Contact Message</h2>

        <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>Company:</strong> ${escapeHtml(data.company)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>

        <hr />

        <p><strong>Message:</strong></p>
        <p>${escapeHtml(data.message)}</p>
      `,
    });

    console.log('ORBIT CONTROL CONTACT SMTP SENT');

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error('ORBIT CONTROL CONTACT SMTP ERROR:', error);

    return Response.json(
      {
        success: false,
        error: 'Unable to send your message right now. Please try again later.',
      },
      { status: 500 }
    );
  }
}
