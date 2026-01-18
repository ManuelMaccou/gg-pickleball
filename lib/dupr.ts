import { unstable_noStore as noStore } from 'next/cache';

// UPDATED: Define a type that matches the actual API response structure.
type DuprTokenResponse = {
  status: 'SUCCESS' | string; // Expect 'SUCCESS', but allow for other string statuses (e.g., 'FAILURE')
  result: {
    token: string;
    expiry: string; // This is an ISO date string
  };
};

export async function getDuprAccessToken(): Promise<string> {
  const { clientKey, clientSecret, environment } = getDuprConfig();
  const baseUrl = `https://${environment}.mydupr.com`;
  const tokenUrl = `${baseUrl}/api/auth/v1.0/token`;

  // 1. Encode client key and secret per DUPR docs: base64(key:secret)
  const credentials = `${clientKey}:${clientSecret}`;
  const encodedCredentials = Buffer.from(credentials).toString('base64');

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'x-authorization': encodedCredentials,
      },
      next: {
        revalidate: 3300, // Cache for 55 minutes
        tags: ['dupr-token'], // Optional tag for on-demand revalidation
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to fetch DUPR token: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = (await response.json()) as DuprTokenResponse;

    if (data.status !== 'SUCCESS' || !data.result || !data.result.token) {
      throw new Error(`API indicated failure or returned an invalid token structure. Response: ${JSON.stringify(data)}`);
    }

    return data.result.token;
    
  } catch (error) {
    console.error("Error fetching DUPR access token:", error);
    throw new Error('Could not retrieve DUPR access token.');
  }
}

function getDuprConfig() {
  noStore();
  
  const clientKey = process.env.DUPR_CLIENT_KEY;
  const clientSecret = process.env.DUPR_CLIENT_SECRET;
  const environment = process.env.DUPR_ENVIRONMENT;

  if (!clientKey || !clientSecret || !environment) {
    throw new Error('DUPR environment variables (KEY, SECRET, ENVIRONMENT) are not set.');
  }
  
  if (environment !== 'uat' && environment !== 'prod') {
      throw new Error("DUPR_ENVIRONMENT must be either 'uat' or 'prod'.");
  }

  return { clientKey, clientSecret, environment };
}