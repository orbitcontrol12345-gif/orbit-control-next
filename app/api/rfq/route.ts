import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
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

    const files = formData.getAll('files') as File[];

    const attachments = await Promise.all(
      files
        .filter((file) => file && file.size > 0)
        .map(async (file) => ({
          filename: file.name,
          content: Buffer.from(await file.arrayBuffer()),
        }))
    );

   const result = await resend.emails.send({
  from: 'Orbit Control RFQ <onboarding@resend.dev>',
  to: ['wael.caroomi@gmail.com'],
  replyTo: data.email,
  subject: `New RFQ - ${data.part_number}`,
  attachments,
  html: `...`,
});

console.log('ORBIT RESEND RESULT:', result);
        <h2>New RFQ Request</h2>

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

    return Response.json({ success: true });
  } catch (error) {
    console.error('RFQ ERROR:', error);

    return Response.json(
      { success: false },
      { status: 500 }
    );
  }
}
