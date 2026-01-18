import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// This function can be moved to a shared lib file if you have one
function getDuprEnvironment() {
  const environment = process.env.DUPR_ENVIRONMENT || 'uat';
  if (environment !== 'uat' && environment !== 'prod') {
    throw new Error("DUPR_ENVIRONMENT must be either 'uat' or 'prod'.");
  }
  const baseUrl = `https://${environment}.mydupr.com`;
  return { environment, baseUrl };
}

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('dupr-user-refresh-token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ message: 'Refresh token not found. User must log in again.' }, { status: 401 });
  }

  try {
    const { baseUrl } = getDuprEnvironment();
    const refreshUrl = `${baseUrl}/api/auth/v1.0/refresh`;

    console.log(`Attempting to refresh token using endpoint: ${refreshUrl}`);

    const response = await fetch(refreshUrl, {
      method: 'POST',
      headers: {
        // The DUPR API standard is 'Authorization: Bearer <token>'
        // If their refresh docs specify a different header, change it here.
        'Authorization': `Bearer ${refreshToken}`
      }
    });

    if (!response.ok) {
      // If the refresh token is expired or invalid, DUPR will likely return 401.
      console.error(`Failed to refresh token. Status: ${response.status}`);
      // Clear the invalid cookies to force a re-login.
      cookieStore.delete('dupr-user-token');
      cookieStore.delete('dupr-user-refresh-token');
      return NextResponse.json({ message: 'Session expired. Please log in again.' }, { status: response.status });
    }

    // IMPORTANT: We need to know the exact structure of the refresh response.
    // We will assume it returns an object with a new access token.
    // Let's log it to be sure.
    const newTokens = await response.json();
    console.log("DUPR Refresh Response Body:", newTokens);

    // Assuming the response looks like: { "token": "...", "refreshToken": "..." }
    // Adjust these keys based on the actual logged response.
    const newUserToken = newTokens.token;
    const newRefreshToken = newTokens.refreshToken; // DUPR might issue a new refresh token

    if (!newUserToken) {
        throw new Error("Refresh response did not contain a new token.");
    }
    
    // Update the cookies with the new tokens
    cookieStore.set('dupr-user-token', newUserToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60, // 1 hour
    });
    
    // If DUPR provides a new refresh token, update it.
    if (newRefreshToken) {
        cookieStore.set('dupr-user-refresh-token', newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
    }

    // Return the new access token so the original failed request can be retried
    return NextResponse.json({ userToken: newUserToken });

  } catch (error) {
    console.error("Error in refresh token route:", error);
    return NextResponse.json({ message: 'Internal server error during token refresh' }, { status: 500 });
  }
}