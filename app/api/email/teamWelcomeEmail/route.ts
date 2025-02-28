import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // Extract JSON body
    const {toEmail, startDate, paymentLink, referralUrl } = body;

    if (!toEmail || !startDate || !paymentLink || !referralUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: {
          email: 'play@ggpickleball.co',
          name: 'GG Pickleball',
        },
        personalizations: [
          {
            to: [{ email: toEmail }],
            dynamic_template_data: {
              start_date: startDate,
              payment_link: paymentLink,
              referral_url: referralUrl,
            },
          },
        ],
        template_id: 'd-a2f7b50532544dcbaea7501daaab26c8',
      }),
    });

    if (!sendgridResponse.ok) {
      const errorText = await sendgridResponse.text();
      return NextResponse.json({ error: `SendGrid Error: ${errorText}` }, { status: 500 });
    }

    return NextResponse.json({ message: 'Email sent successfully' }, { status: 200 });
  } catch (error) {
    console.error('SendGrid Email Error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
