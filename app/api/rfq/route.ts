import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

export async function POST(req: Request) {
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
    const formData = await req.formData();

    const data = {
      name: String(formData.get('name') || ''),
      company: String(formData.get('company') || ''),
      email: String(formData.get('email') || ''),
      phone: String(formData.get('phone') || ''),
      country: String(formData.get('country') || ''),
      part_number: String(formData.get('part_number') || ''),
      quantity: String(formData.get('quantity') || '1'),
      message: String(formData.get('message') || ''),
    };

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
        data.part_number || 'General Inquiry'
      }`,
      html: `
        <h2>New Orbit Control RFQ Request</h2>

        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Company:</strong> ${data.company}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>Country:</strong> ${data.country}</p>

        <hr />

        <p><strong>Part Number:</strong> ${data.part_number}</p>
        <p><strong>Quantity:</strong> ${data.quantity}</p>

        <hr />

        <p><strong>Message:</strong></p>
        <p>${data.message || 'No message provided'}</p>
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
