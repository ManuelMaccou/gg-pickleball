// lib/services/dupr/duprAuth.ts

// Global variables to cache the token in memory during warm lambda execution
let cachedToken: string | null = null;
let tokenExpiration: number = 0;

/**
 * Generates a new DUPR Bearer token using Client Key and Secret
 */
async function generateNewToken(): Promise<string> {
  const DUPR_API_BASE_URL = process.env.DUPR_API_BASE_URL;
  
  // 1. Get Encoded Credentials
  const credentials = process.env.ENCODED_CREDENTIALS;

  if (!credentials) {
    throw new Error("Missing ENCODED_CREDENTIALS in environment variables.");
  }

  // 2. Call DUPR Auth Endpoint
  // Using the path that worked for you in Postman
  const response = await fetch(`https://${DUPR_API_BASE_URL}/api/auth/v1.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-authorization': credentials 
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate DUPR Token (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  // FIX: Handle the nested structure from your Postman response
  // Response: { status: "SUCCESS", result: { token: "...", expiry: "..." } }
  let newToken = '';

  if (typeof data.result === 'string') {
    // Case A: result is just the token string
    newToken = data.result;
  } else if (data.result && data.result.token) {
    // Case B: result is an object containing the token (Your case)
    newToken = data.result.token;
  } else if (data.token) {
    // Case C: token is at the top level
    newToken = data.token;
  }

  if (!newToken) {
    console.error("DUPR Auth Parse Error. Received:", JSON.stringify(data));
    throw new Error("DUPR Auth response did not contain a valid token string.");
  }

  return newToken;
}

/**
 * Returns a valid token. Uses cache if valid, otherwise generates new.
 */
export async function getDuprToken(): Promise<string> {
  const now = Date.now();
  
  // If we have a token and it's not expired (minus 5 minute buffer)
  if (cachedToken && now < tokenExpiration - (5 * 60 * 1000)) {
    return cachedToken;
  }

  const token = await generateNewToken();
  
  cachedToken = token;
  tokenExpiration = Date.now() + (3600 * 1000); // 1 Hour validity
  
  return token;
}

/**
 * A wrapper around fetch that automatically handles DUPR Authentication.
 * It adds the Bearer token and retries once if a 401 is encountered.
 */
export async function authenticatedDuprFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // 1. Get Token
  let token = await getDuprToken();

  // 2. Prepare Headers
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  headers.set('accept', 'application/json');

  // 3. First Attempt
  let response = await fetch(url, { ...options, headers });

  // 4. Handle 401 (Unauthorized/Expired)
  if (response.status === 401) {
    console.warn("DUPR Token expired (401). Refreshing and retrying...");
    
    // Clear cache and force refresh
    cachedToken = null; 
    token = await getDuprToken();
    
    // Update header with new token
    headers.set('Authorization', `Bearer ${token}`);
    
    // Retry request
    response = await fetch(url, { ...options, headers });
  }

  return response;
}