import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('dupr-user-token');
  cookieStore.delete('dupr-user-refresh-token');
  
  return NextResponse.json({ message: 'Logged out successfully' });
}