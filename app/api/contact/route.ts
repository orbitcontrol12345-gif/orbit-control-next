import { Resend } from 'resend';

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
    const data = await req.json();

    const result = await resend.emails.send({
      from: 'Orbit Control Contact <info@orbit-surplus.com>',
      to: ['info@orbit-surplus.com'],
      replyTo: data.email || 'info@orbit-surplus.com',
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

    if (result.error) {
      console.error('ORBIT CONTROL CONTACT RESEND ERROR:', result.error);

      return Response.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    console.log('ORBIT CONTROL CONTACT SENT:', result.data);

    return Response.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('ORBIT CONTROL CONTACT ERROR:', error);

    return Response.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
