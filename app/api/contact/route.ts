import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const result = await resend.emails.send({
      from: 'Orbit Control Contact <onboarding@resend.dev>',
      to: ['orbitcontrol12345@gmail.com'],
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

    console.log('ORBIT CONTACT RESULT:', result);

    return Response.json({ success: true, result });
  } catch (error) {
    console.error('CONTACT ERROR:', error);
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

