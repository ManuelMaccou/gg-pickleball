import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // Extract JSON body
    const {toEmails, messageSender, messageText, messagePreheader, chatUrl } = body;

    if (!toEmails || !Array.isArray(toEmails) || toEmails.length === 0) {
      return NextResponse.json({ error: 'Invalid email list' }, { status: 400 });
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
            dynamic_template_data: {
              messageSender,
              messageText,
              messagePreheader,
              chatUrl
            },
          },
        ],
        template_id: 'd-fc9902550d5c424c828fe1471984ac9d',
      }),
    });

    if (!sendgridResponse.ok) {
      const errorText = await sendgridResponse.text();
      return NextResponse.json({ error: `SendGrid Error: ${errorText}` }, { status: 500 });
    }

    return NextResponse.json({ message: 'New message email sent successfully' }, { status: 200 });
  } catch (error) {
    console.error('SendGrid Email Error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
