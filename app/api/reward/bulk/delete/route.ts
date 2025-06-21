import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Reward from '@/app/models/Reward';
import { logError } from '@/lib/sentry/logger';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';

export async function POST(req: NextRequest) {

  const user = await getAuthorizedUser(req)
  console.log('authd user:', user)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    await connectToDatabase();
    const { rewardIds }: { rewardIds: string[] } = await req.json();

    if (!Array.isArray(rewardIds) || rewardIds.length === 0) {
      return NextResponse.json({ error: 'Missing rewardIds' }, { status: 400 });
    }

    const result = await Reward.deleteMany({ _id: { $in: rewardIds } });

    return NextResponse.json({
      message: `Deleted ${result.deletedCount} rewards`,
      deleted: result.deletedCount,
    });
  } catch (error) {
    logError(error, { message: 'Error deleting rewards in batch' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
