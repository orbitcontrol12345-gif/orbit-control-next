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
    const data = await req.json();

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
      replyTo: data.email || undefined,
      subject: `Orbit Control Contact - ${data.subject || 'New Message'}`,
      html: `
        <h2>New Orbit Control Contact Message</h2>

        <p><strong>Name:</strong> ${data.name || ''}</p>
        <p><strong>Company:</strong> ${data.company || ''}</p>
        <p><strong>Email:</strong> ${data.email || ''}</p>
        <p><strong>Phone:</strong> ${data.phone || ''}</p>
        <p><strong>Subject:</strong> ${data.subject || ''}</p>

        <hr />

        <p><strong>Message:</strong></p>
        <p>${data.message || 'No message provided'}</p>
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
        error: String(error),
      },
      { status: 500 }
    );
  }
}
