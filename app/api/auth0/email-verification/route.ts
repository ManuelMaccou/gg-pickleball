// Sent to captains who have have started registration

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId, email } = await req.json()

  try {
    // Get Access Token
    const tokenResponse = await fetch(`https://dev-6x1ms01gzkmckkbr.us.auth0.com/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        audience: 'https://dev-6x1ms01gzkmckkbr.us.auth0.com/api/v2/',
        grant_type: 'client_credentials',
      }),
    })

    const { access_token } = await tokenResponse.json()

    if (!access_token) {
      console.error('Access token response:', await tokenResponse.json())
      return NextResponse.json({ error: 'Auth0 token request failed' }, { status: 500 })
    }

    // Create email verification link
    const emailVerificationResponse = await fetch(`https://dev-6x1ms01gzkmckkbr.us.auth0.com/api/v2/tickets/email-verification`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        client_id: process.env.AUTH0_CLIENT_ID,
        ttl_sec: 432000,
        includeEmailInRedirect: true,
      })
    });

    const { ticket } = await emailVerificationResponse.json()
    console.log('Email verification response body:', ticket)

    const verificationUrl = ticket

    if (!verificationUrl) {
  
      console.error('Failed to create email verification ticket:')
      return NextResponse.json({ error: 'There was an unexpected error. Please try again. Code 419' })
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
        subject: 'Verify your email',
        personalizations: [
          {
            to: [{ email }],
            dynamic_template_data: {
              verify_link: verificationUrl,
              email: email,
            },
          },
        ],
        template_id: 'd-ef02471e456c4b22aa49ab1afb4e2c64',
      }),
    })

    if (!sendgridResponse.ok) {
      const errorBody = await sendgridResponse.text()
      console.error('SendGrid API error:', errorBody)
      return NextResponse.json({ error: 'Failed to send email' }, { status: sendgridResponse.status })
    }

    return NextResponse.json({ message: 'Verification email sent successfully' })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}