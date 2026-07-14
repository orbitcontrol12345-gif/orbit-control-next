import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const smtpHost = process.env.MXROUTE_SMTP_HOST;
  const smtpUser = process.env.MXROUTE_SMTP_USER;
  const smtpPass = process.env.MXROUTE_SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return NextResponse.json(
      {
        success: false,
        error: 'MXroute SMTP environment variables are missing',
      },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();

    const data = Object.fromEntries(formData.entries());
    const files = formData.getAll('files') as File[];

    const attachments = await Promise.all(
      files
        .filter((file) => file && file.size > 0)
        .map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();

          return {
            filename: file.name,
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
        String(data.email || '').trim() || undefined,
      subject: `Orbit Control Sell Surplus - ${
        data.company || 'New Offer'
      }`,
      attachments,
      html: `
        <h2>New Orbit Control Sell Surplus Inventory Offer</h2>

        <p><strong>Company:</strong> ${data.company || ''}</p>
        <p><strong>Contact Person:</strong> ${
          data.contact_person || ''
        }</p>
        <p><strong>Email:</strong> ${data.email || ''}</p>
        <p><strong>Phone / WhatsApp:</strong> ${
          data.phone || ''
        }</p>
        <p><strong>Country:</strong> ${data.country || ''}</p>

        <hr />

        <p><strong>Brand / Manufacturer:</strong> ${
          data.brand || ''
        }</p>

        <p><strong>Part Numbers:</strong></p>
        <p>${data.part_numbers || 'No part numbers provided'}</p>

        <p><strong>Quantity:</strong> ${data.quantity || ''}</p>
        <p><strong>Condition:</strong> ${data.condition || ''}</p>

        <hr />

        <p><strong>Additional Details:</strong></p>
        <p>${data.message || 'No additional details provided'}</p>
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
        error: String(error),
      },
      { status: 500 }
    );
  }
}
