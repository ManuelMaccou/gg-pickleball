import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

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

    if (!access_token) return NextResponse.json({ error: 'There was an unexpected error. Please try again' })

    // Create Auth0 User
    const createUserResponse = await fetch(`https://dev-6x1ms01gzkmckkbr.us.auth0.com/api/v2/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: crypto.randomUUID(),
        connection: 'Username-Password-Authentication',
        email_verified: false,
      }),
    })

    if (!createUserResponse.ok) {
      const errorData = await createUserResponse.json()
      console.error('Failed to create Auth0 user:', errorData)
      return NextResponse.json({ error: 'There was an unexpected error. Please try again.' }, { status: createUserResponse.status })
    }

    const createdUser = await createUserResponse.json()

    // Create Password Reset Ticket
    const ticketResponse = await fetch(`https://dev-6x1ms01gzkmckkbr.us.auth0.com/api/v2/tickets/password-change#type=invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: createdUser.user_id,
        ttl_sec: 2592000,
      }),
    })

    const ticketData = await ticketResponse.json()

    //* If there is an error creating the ticket, send yourself an email with instructions to generate a 
    // password reset link and manually send the welcome email with that link.
    if (!ticketResponse.ok) {
      console.error('Failed to create password reset ticket:', ticketData)
      return NextResponse.json({ error: ticketData }, { status: ticketResponse.status })
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
            to: [{ email }],
            dynamic_template_data: {
              start_date: "March 15, 2025",
              link: ticketData.ticket,
            },
          },
        ],
        template_id: 'd-3f45ecae5efc4510877518a84c12809a',
      }),
    })

    if (!sendgridResponse.ok) {
      const errorBody = await sendgridResponse.text()
      console.error('SendGrid API error:', errorBody)
      return NextResponse.json({ error: 'Failed to send email' }, { status: sendgridResponse.status })
    }

    return NextResponse.json({
      auth0User: createdUser,
      passwordSetupLink: ticketData.ticket,
    })


  } catch (error) {
    console.error('Error creating partner user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
