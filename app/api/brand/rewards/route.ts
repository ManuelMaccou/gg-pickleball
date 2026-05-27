import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import User from "@/app/models/User";
import { logError } from "@/lib/sentry/logger";
import { requiresBrandAdmin } from "@/lib/auth/requiresBrandAdmin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const skip = (page - 1) * limit;

  // ── Auth guard ────────────────────────────────────────────────────────────
  const auth = await requiresBrandAdmin(request, clientId);
  if (auth.error) return auth.error;
  // auth.clientId is now verified — use it instead of the raw param
  const verifiedClientId = auth.clientId;

  try {
    await connectToDatabase();

    // ObjectId.isValid check is still worth keeping as a belt-and-suspenders
    // guard against malformed IDs slipping through (e.g. if adminLocationId
    // was somehow stored in a bad format).
    if (!Types.ObjectId.isValid(verifiedClientId)) {
      return NextResponse.json({ error: 'Invalid client ID format' }, { status: 400 });
    }

    const objectIdClient = new Types.ObjectId(verifiedClientId);

    const pipeline = [
      {
        $match: {
          "stats.global.rewards.sponsoringClientId": objectIdClient
        }
      },
      { $unwind: "$stats.global.rewards" },
      {
        $match: {
          "stats.global.rewards.sponsoringClientId": objectIdClient
        }
      },
      { $sort: { "stats.global.rewards.earnedAt": -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: "rewards",
                localField: "stats.global.rewards.rewardId",
                foreignField: "_id",
                as: "rewardDetails"
              }
            },
            {
              $lookup: {
                from: "rewardcodes",
                localField: "stats.global.rewards.rewardCodeId",
                foreignField: "_id",
                as: "codeDetails"
              }
            },
            { $unwind: { path: "$codeDetails", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: "achievements",
                localField: "codeDetails.achievementId",
                foreignField: "_id",
                as: "achievementDetails"
              }
            },
            {
              $project: {
                playerName: "$name",
                playerEmail: "$email",
                earnedAt: "$stats.global.rewards.earnedAt",
                reward: { $arrayElemAt: ["$rewardDetails", 0] },
                codeDoc: "$codeDetails",
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

    const formattedRewards = data.map((item: any) => {
      const rewardSnapshot = item.codeDoc?.reward;
      const activeReward = rewardSnapshot || item.reward;

      return {
        _id: item.codeDoc?._id || new Types.ObjectId(),
        playerName: item.playerName,
        playerEmail: item.playerEmail || "No email",
        rewardName: activeReward?.friendlyName || "Unknown",
        rewardProduct: activeReward?.product === 'custom' ? undefined : activeReward?.product,
        achievementName: item.achievement?.friendlyName || "Unknown Achievement",
        code: item.codeDoc?.code || "PENDING",
        earnedAt: item.earnedAt,
        redeemed: !!item.codeDoc?.redeemed,
        redemptionDate: item.codeDoc?.redemptionDate
      };
    });

    return NextResponse.json({
      rewards: formattedRewards,
      pagination: { total, page, totalPages }
    });

  } catch (error) {
    logError(error, { endpoint: 'GET /api/brand/rewards', clientId: verifiedClientId });
    return NextResponse.json({ error: 'Failed to fetch rewards.' }, { status: 500 });
  }
}