import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        success: false,
        error: 'RESEND_API_KEY is missing',
      },
      { status: 500 }
    );
  }

  const resend = new Resend(apiKey);

  try {
    const formData = await req.formData();

    const data = Object.fromEntries(formData.entries());
    const files = formData.getAll('files') as File[];

    const attachments = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();

        return {
          filename: file.name,
          content: Buffer.from(arrayBuffer),
        };
      })
    );

    await resend.emails.send({
      from: 'Xeltronic Sell Surplus <quote@xeltronic.com>',
      to: ['quote@xeltronic.com'],
      replyTo: data.email as string,
      subject: `Sell Surplus Inventory - ${data.company || 'New Offer'}`,
      attachments,
      html: `
        <h2>New Sell Surplus Inventory Offer</h2>

        <p><strong>Company:</strong> ${data.company}</p>
        <p><strong>Contact Person:</strong> ${data.contact_person}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone / WhatsApp:</strong> ${data.phone}</p>
        <p><strong>Country:</strong> ${data.country}</p>

        <hr />

        <p><strong>Brand / Manufacturer:</strong> ${data.brand}</p>
        <p><strong>Part Numbers:</strong></p>
        <p>${data.part_numbers || 'No part numbers provided'}</p>
        <p><strong>Quantity:</strong> ${data.quantity}</p>
        <p><strong>Condition:</strong> ${data.condition}</p>

        <hr />

        <p><strong>Additional Details:</strong></p>
        <p>${data.message || 'No additional details provided'}</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('SELL SURPLUS ERROR:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
