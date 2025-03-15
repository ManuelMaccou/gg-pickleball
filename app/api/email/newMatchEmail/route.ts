import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // Extract JSON body
    const {toEmails, matchUrl } = body;

    if (!toEmails || !Array.isArray(toEmails) || toEmails.length === 0 || !matchUrl) {
      return NextResponse.json({ error: 'Missing required fields or invalid email list' }, { status: 400 });
    }

    const recipients = toEmails.map((email) => ({ email }));

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
            to: recipients,
            cc: [
              {
                email: 'book@ggpickleball.co'
              }
            ],
            dynamic_template_data: {
              matchUrl
            },
          },
        ],
        template_id: 'd-7b942de05ec14773a0daef4640a17fb0',
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
