import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // Extract JSON body
    const {toEmail, startDate, referralUrl } = body;

    if (!toEmail || !startDate || !referralUrl) {
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
              referral_url: referralUrl,
            },
          },
        ],
        template_id: 'd-5480fda014f8495ea0868b8cbdd0bbfd',
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
