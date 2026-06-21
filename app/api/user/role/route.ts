import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import Admin from '@/app/models/Admin';
import { IUser } from '@/app/types/databaseTypes'; // <--- IMPORT YOUR TYPE
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const auth0Id = req.nextUrl.searchParams.get('auth0Id');
    if (!auth0Id) {
        return NextResponse.json({ error: 'Missing auth0Id' }, { status: 400 });
    }

    await connectToDatabase();
    
    // 1. Find the User
    // FIX: Pass the IUser interface to .lean() so TypeScript knows the shape
    const user = await User.findOne({ auth0Id })
      .select('_id superAdmin accountClaimed')
      .lean<IUser>(); 

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Check if they have ANY admin records
    const adminRecord = await Admin.findOne({ user: user._id }).lean();

    // 3. Return the routing flags
    return NextResponse.json({
      isSuperAdmin: !!user.superAdmin,
      isClubAdmin: !!adminRecord,
      accountClaimed: !!user.accountClaimed
    });

  } catch (error) {
    console.error("Role check error:", error);
    const errorId = logError(error, { endpoint: 'GET /api/user/role' });
    return NextResponse.json({ errorId, error: 'Server error' }, { status: 500 });
  }
}
