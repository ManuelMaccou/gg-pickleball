import { NextResponse } from "next/server";
import { Types } from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import User from "@/app/models/User";
import { logError } from "@/lib/sentry/logger";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const skip = (page - 1) * limit;

  try {
    await connectToDatabase();

    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      return NextResponse.json({ error: 'Valid Client ID is required' }, { status: 400 });
    }

    const objectIdClient = new Types.ObjectId(clientId);

    // Aggregation Pipeline
    const pipeline = [
      // 1. MATCH: Only look at users who have at least one reward from this client
      { 
        $match: { 
          "stats.global.rewards.sponsoringClientId": objectIdClient 
        } 
      },

      // 2. UNWIND: Deconstruct the rewards array so each reward is its own document
      { $unwind: "$stats.global.rewards" },

      // 3. MATCH AGAIN: Filter the unwound documents to keep ONLY this client's rewards
      { 
        $match: { 
          "stats.global.rewards.sponsoringClientId": objectIdClient 
        } 
      },

      // 4. SORT: Sort by earnedAt date (newest first)
      { $sort: { "stats.global.rewards.earnedAt": -1 } },

      // 5. FACET: Run two queries in parallel (get data + get total count for pagination)
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: limit },
            
            // 6. LOOKUP: Populate Reward Details (to get name/product)
            // Note: We use the RewardCode snapshot usually, but fallback to Reward collection if needed
            {
              $lookup: {
                from: "rewards", 
                localField: "stats.global.rewards.rewardId",
                foreignField: "_id",
                as: "rewardDetails"
              }
            },
            
            // 7. LOOKUP: Populate Reward Code Details (To get code string & redemption status)
            {
              $lookup: {
                from: "rewardcodes", 
                localField: "stats.global.rewards.rewardCodeId",
                foreignField: "_id",
                as: "codeDetails"
              }
            },

            // --- NEW STEPS FOR ACHIEVEMENT NAME ---
            
            // 7a. Unwind codeDetails so we can access its fields for the next lookup
            { $unwind: { path: "$codeDetails", preserveNullAndEmptyArrays: true } },

            // 7b. Lookup Achievement based on the ID stored in the RewardCode
            {
              $lookup: {
                from: "achievements",
                localField: "codeDetails.achievementId",
                foreignField: "_id",
                as: "achievementDetails"
              }
            },

            // 8. PROJECT: Clean up the output
            {
              $project: {
                playerName: "$name",
                playerEmail: "$email",
                earnedAt: "$stats.global.rewards.earnedAt",
                // Get the first item from the arrays
                reward: { $arrayElemAt: ["$rewardDetails", 0] },
                codeDoc: "$codeDetails", // Already unwound
                achievement: { $arrayElemAt: ["$achievementDetails", 0] }
              }
            }
          ]
        }
      }
    ];

    const result = await User.aggregate(pipeline as any);
    
    const data = result[0].data;
    const total = result[0].metadata[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // --- THIS IS THE MAPPING BLOCK YOU ASKED ABOUT ---
    const formattedRewards = data.map((item: any) => {
      // Prefer the snapshot inside the code document if available, else fallback
      const rewardSnapshot = item.codeDoc?.reward; 
      const activeReward = rewardSnapshot || item.reward;

      return {
        _id: item.codeDoc?._id || new Types.ObjectId(),
        playerName: item.playerName,
        playerEmail: item.playerEmail || "No email",
        
        rewardName: activeReward?.friendlyName || "Unknown",
        rewardProduct: activeReward?.product === 'custom' ? undefined : activeReward?.product,
        
        // --- NEW: Map the achievement name ---
        achievementName: item.achievement?.friendlyName || "Unknown Achievement",

        code: item.codeDoc?.code || "PENDING",
        earnedAt: item.earnedAt,
        redeemed: !!item.codeDoc?.redeemed,
        redemptionDate: item.codeDoc?.redemptionDate
      };
    });

    return NextResponse.json({
      rewards: formattedRewards,
      pagination: {
        total,
        page,
        totalPages
      }
    });

  } catch (error) {
    logError(error, { endpoint: 'GET /api/brand/rewards', clientId: clientId ?? 'null' });
    return NextResponse.json({ error: 'Failed to fetch rewards.' }, { status: 500 });
  }
}