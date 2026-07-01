import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const data = await req.json();

    console.log('CONTACT DATA:', data);
console.log('CONTACT API HIT', new Date().toISOString());
console.log(data);
    await resend.emails.send({
  from: 'Orbit Control Contact <onboarding@resend.dev>'
  to: ['Orbit Control Contact Form'],
      replyTo: data.email,
      subject: `Contact Form - ${data.subject}`,
      html: `
        <h2>New Contact Message</h2>

        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Company:</strong> ${data.company}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>Subject:</strong> ${data.subject}</p>

        <hr />

        <p><strong>Message:</strong></p>
        <p>${data.message || 'No message provided'}</p>
      `,
    });

    console.log('CONTACT SENT');

    return Response.json({ success: true });
  } catch (error) {
    console.error('CONTACT ERROR:', error);
    return Response.json({ success: false }, { status: 500 });
  }
}
