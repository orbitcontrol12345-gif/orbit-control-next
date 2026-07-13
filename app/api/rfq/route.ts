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

    const result = await resend.emails.send({
      from: 'Orbit Control RFQ <rfq@orbit-surplus.com>',
      to: ['rfq@orbit-surplus.com'],
      replyTo: data.email || 'rfq@orbit-surplus.com',
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

    if (result.error) {
      console.error('ORBIT CONTROL RFQ RESEND ERROR:', result.error);

      return Response.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    console.log('ORBIT CONTROL RFQ SENT:', result.data);

    return Response.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('ORBIT CONTROL RFQ ERROR:', error);

    return Response.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
