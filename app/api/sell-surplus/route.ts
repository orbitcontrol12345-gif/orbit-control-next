import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import {
  checkPublicFormRateLimit,
  cleanFormText,
  escapeHtml,
  isValidEmail,
  sanitizeAttachmentFilename,
  validateAttachments,
} from '@/lib/public-form-security';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rateLimit = checkPublicFormRateLimit(req, 'sell-surplus');

  if (!rateLimit.allowed) {
    return NextResponse.json(
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
    console.error('ORBIT CONTROL SELL SURPLUS SMTP CONFIGURATION IS MISSING');

    return NextResponse.json(
      {
        success: false,
        error: 'The inventory service is temporarily unavailable. Please try again later.',
      },
      { status: 500 }
    );
  }

  try {
    let formData: FormData;

    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'A valid form-data request body is required.',
        },
        { status: 400 },
      );
    }

    if (cleanFormText(formData.get('website'), 200)) {
      return NextResponse.json({ success: true });
    }

    const data = {
      company: cleanFormText(formData.get('company'), 160),
      contact_person: cleanFormText(
        formData.get('contact_person'),
        120,
      ),
      email: cleanFormText(formData.get('email'), 254),
      phone: cleanFormText(formData.get('phone'), 80),
      country: cleanFormText(formData.get('country'), 100),
      brand: cleanFormText(formData.get('brand'), 200),
      part_numbers: cleanFormText(
        formData.get('part_numbers'),
        10000,
      ),
      quantity: cleanFormText(formData.get('quantity'), 50),
      condition: cleanFormText(formData.get('condition'), 100),
      message: cleanFormText(formData.get('message'), 5000),
    };
    const files = formData
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const attachmentError = validateAttachments(files);

    if (
      !data.contact_person ||
      !isValidEmail(data.email) ||
      !data.country ||
      !data.part_numbers ||
      !data.condition
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please check the required inventory fields.',
        },
        { status: 400 },
      );
    }

    if (attachmentError) {
      return NextResponse.json(
        {
          success: false,
          error: attachmentError,
        },
        { status: 400 },
      );
    }

    const attachments = await Promise.all(
      files
        .map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();

          return {
            filename: sanitizeAttachmentFilename(file.name),
            content: Buffer.from(arrayBuffer),
          };
        })
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
      from: `"Orbit Control Sell Surplus" <${smtpUser}>`,
      to: 'surplus@orbit-surplus.com',
      replyTo:
        data.email,
      subject: `Orbit Control Sell Surplus - ${
        data.company.replace(/[\r\n]+/g, ' ') || 'New Offer'
      }`,
      attachments,
      html: `
        <h2>New Orbit Control Sell Surplus Inventory Offer</h2>

        <p><strong>Company:</strong> ${escapeHtml(data.company)}</p>
        <p><strong>Contact Person:</strong> ${escapeHtml(data.contact_person)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
        <p><strong>Phone / WhatsApp:</strong> ${escapeHtml(data.phone)}</p>
        <p><strong>Country:</strong> ${escapeHtml(data.country)}</p>

        <hr />

        <p><strong>Brand / Manufacturer:</strong> ${
          escapeHtml(data.brand)
        }</p>

        <p><strong>Part Numbers:</strong></p>
        <p>${escapeHtml(data.part_numbers)}</p>

        <p><strong>Quantity:</strong> ${escapeHtml(data.quantity)}</p>
        <p><strong>Condition:</strong> ${escapeHtml(data.condition)}</p>

        <hr />

        <p><strong>Additional Details:</strong></p>
        <p>${escapeHtml(data.message || 'No additional details provided')}</p>
      `,
    });

    console.log('ORBIT CONTROL SELL SURPLUS SMTP SENT');

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      'ORBIT CONTROL SELL SURPLUS SMTP ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to send your inventory offer right now. Please try again later.',
      },
      { status: 500 }
    );
  }
}
