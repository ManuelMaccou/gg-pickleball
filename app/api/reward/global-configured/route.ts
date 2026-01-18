import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import GGRConfig from '@/app/models/GGRConfig';
import Reward from '@/app/models/Reward';
import Achievement from '@/app/models/Achievement';
import Client from '@/app/models/Client'; // <--- IMPORT CLIENT MODEL
import { Types } from 'mongoose';

type Sponsorship = {
  sponsoringClientId: Types.ObjectId;
  rewardId: Types.ObjectId;
};

export async function GET() {
  try {
    await connectToDatabase();

    const ggrConfig = await GGRConfig.findOne();
    if (!ggrConfig || !ggrConfig.globalRewardConfig || ggrConfig.globalRewardConfig.size === 0) {
      return NextResponse.json({ rewards: [] });
    }

    const rewardEntries = Array.from(ggrConfig.globalRewardConfig.entries()) as [string, Sponsorship[]][];
    
    // --- START OF MODIFICATIONS ---

    const allSponsorships = rewardEntries.flatMap(([, sponsorships]) => sponsorships);
    const uniqueRewardIds = [...new Set(allSponsorships.map(s => s.rewardId))];
    const uniqueClientIds = [...new Set(allSponsorships.map(s => s.sponsoringClientId))];
    const achievementNames = rewardEntries.map(([name]) => name);

    const [rewards, achievements, clients] = await Promise.all([
      Reward.find({ _id: { $in: uniqueRewardIds } }),
      Achievement.find({ name: { $in: achievementNames } }),
      Client.find({ _id: { $in: uniqueClientIds } }).select('name icon'),
    ]);

    const rewardsById = new Map(rewards.map(r => [r._id.toString(), r]));
    const achievementsByName = new Map(achievements.map(a => [a.name, a]));
    const clientsById = new Map(clients.map(c => [c._id.toString(), c]));

    const result = rewardEntries.flatMap(([achievementName, sponsorships]) => {
      const achievement = achievementsByName.get(achievementName);
      if (!achievement) return [];

      return sponsorships.map(sponsorship => {
        const reward = rewardsById.get(sponsorship.rewardId.toString());
        const sponsoringClient = clientsById.get(sponsorship.sponsoringClientId.toString());

        if (!reward || !sponsoringClient) return null;

        return {
          achievement: {
            _id: achievement._id.toString(),
            name: achievement.name,
            friendlyName: achievement.friendlyName,
          },
          reward: reward, 
          // The field name should match the frontend type: 'sponsoringClient'
          sponsoringClient: {
            _id: sponsoringClient._id.toString(),
            name: sponsoringClient.name,
            icon: sponsoringClient.icon
          },
        };
      }).filter(Boolean); // Filter out any null results from missing data
    });

    // --- END OF MODIFICATIONS ---

    return NextResponse.json({ rewards: result });

  } catch (error) {
    console.error('Error fetching global configured rewards:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}