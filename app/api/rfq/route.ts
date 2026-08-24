import nodemailer from 'nodemailer';
import {
  checkPublicFormRateLimit,
  cleanFormText,
  escapeHtml,
  isValidEmail,
  validateAttachments,
} from '@/lib/public-form-security';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rateLimit = checkPublicFormRateLimit(req, 'rfq');

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
    return Response.json(
      {
        success: false,
        error: 'MXroute SMTP environment variables are missing',
      },
      { status: 500 }
    );
  }

  try {
    let formData: FormData;

    try {
      formData = await req.formData();
    } catch {
      return Response.json(
        {
          success: false,
          error: 'A valid form-data request body is required.',
        },
        { status: 400 },
      );
    }

    if (cleanFormText(formData.get('website'), 200)) {
      return Response.json({ success: true });
    }

    const data = {
      name: cleanFormText(formData.get('name'), 120),
      company: cleanFormText(formData.get('company'), 160),
      email: cleanFormText(formData.get('email'), 254),
      phone: cleanFormText(formData.get('phone'), 80),
      country: cleanFormText(formData.get('country'), 100),
      part_number: cleanFormText(formData.get('part_number'), 1000),
      quantity: cleanFormText(formData.get('quantity') || '1', 20),
      message: cleanFormText(formData.get('message'), 5000),
    };
    const quantity = Number(data.quantity);
    const files = formData
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const attachmentError = validateAttachments(files);

    if (
      !data.name ||
      !data.company ||
      !isValidEmail(data.email) ||
      !data.country ||
      !data.part_number ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100000
    ) {
      return Response.json(
        {
          success: false,
          error: 'Please check the required RFQ fields.',
        },
        { status: 400 },
      );
    }

    if (attachmentError) {
      return Response.json(
        {
          success: false,
          error: attachmentError,
        },
        { status: 400 },
      );
    }

    const attachments = await Promise.all(
      files.map(async (file) => ({
        filename: file.name,
        content: Buffer.from(await file.arrayBuffer()),
      })),
    );

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
      from: `"Orbit Control RFQ" <${smtpUser}>`,
      to: 'rfq@orbit-surplus.com',
      replyTo: data.email || undefined,
      subject: `New Orbit Control RFQ - ${
        data.part_number.replace(/[\r\n]+/g, ' ') ||
        'General Inquiry'
      }`,
      attachments,
      html: `
        <h2>New Orbit Control RFQ Request</h2>

        <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>Company:</strong> ${escapeHtml(data.company)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>
        <p><strong>Country:</strong> ${escapeHtml(data.country)}</p>

        <hr />

        <p><strong>Part Number:</strong> ${escapeHtml(data.part_number)}</p>
        <p><strong>Quantity:</strong> ${quantity}</p>

        <hr />

        <p><strong>Message:</strong></p>
        <p>${escapeHtml(data.message || 'No message provided')}</p>
      `,
    });

    console.log('ORBIT CONTROL RFQ SMTP SENT');

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error('ORBIT CONTROL RFQ SMTP ERROR:', error);

    return Response.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
