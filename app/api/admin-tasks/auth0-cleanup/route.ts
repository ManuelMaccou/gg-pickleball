import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';

// Helper to get the Management API Token (Same as in your userService)
async function getManagementApiToken(): Promise<string> {
  const response = await fetch(`https://${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_M2M_CLIENT_ID!,
      client_secret: process.env.AUTH0_M2M_CLIENT_SECRET!,
      audience: `https://${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to get Auth0 Management API token.');
  }
  
  const data = await response.json();
  return data.access_token;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  // SECURITY: Strictly limit this to Super Admins
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser || !authorizedUser.superAdmin) {
    return NextResponse.json({ error: 'Unauthorized. Super Admin only.' }, { status: 403 });
  }

  try {
    const { excludedEmails = [] } = await req.json();
    const token = await getManagementApiToken();
    const API_BASE = `https://${process.env.AUTH0_ISSUER_BASE_URL}/api/v2`;
    
    // Normalize emails for safe comparison
    const excludeSet = new Set(
      excludedEmails.map((e: string) => e.toLowerCase().trim())
    );

    let allUsers: any[] = [];
    let page = 0;
    let hasMore = true;

    // 1. Fetch ALL users from Auth0 via REST API
    while (hasMore) {
      const response = await fetch(`${API_BASE}/users?page=${page}&per_page=50`, {
        headers: { authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to fetch users: ${response.statusText}`);
      
      const users = await response.json();
      
      if (users.length === 0) {
        hasMore = false;
      } else {
        allUsers.push(...users);
        page++;
      }
    }

    // 2. Filter out the users we want to KEEP
    const usersToDelete = allUsers.filter(u => {
      if (!u.email) return true; // Delete users without emails just in case
      return !excludeSet.has(u.email.toLowerCase().trim());
    });

    // 3. Delete Users (Safely throttled via REST API)
    let deletedCount = 0;
    for (const u of usersToDelete) {
      if (!u.user_id) continue;
      
      try {
        const deleteRes = await fetch(`${API_BASE}/users/${encodeURIComponent(u.user_id)}`, {
            method: 'DELETE',
            headers: { authorization: `Bearer ${token}` }
        });

        if (deleteRes.ok) {
            deletedCount++;
        } else {
            console.error(`Failed to delete ${u.email}: ${deleteRes.statusText}`);
        }
        
        // Throttling: Auth0 Management API limits are strict (2-10 requests per second)
        // 250ms ensures we only do 4 requests per second.
        await delay(250); 
      } catch (err: any) {
        console.error(`Failed to delete user ${u.email}:`, err.message || err);
      }
    }

    return NextResponse.json({ 
        success: true, 
        deletedCount, 
        skippedCount: allUsers.length - deletedCount,
        totalAuth0Users: allUsers.length 
    });

  } catch (error: any) {
    console.error('Auth0 Cleanup Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to clean Auth0' }, { status: 500 });
  }
}