import { NextResponse } from "next/server";
import { Types, startSession } from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import User from "@/app/models/User";
import Client from "@/app/models/Client";
import Reward from "@/app/models/Reward";
import SourceRewardConfig from "@/app/models/SourceRewardConfig";
import { DateTime } from "luxon";
import { createRewardCodeInDB } from "@/lib/rewards/createRewardCodeInDB";
import { generateUniqueRewardCode } from "@/lib/rewards/generateUniqueRewardCode";
import { createShopifyDiscountCode } from "@/lib/shopify/createShopifyDiscountCode"; 
import { IAchievement, IReward, ISourceRewardConfig } from "@/app/types/databaseTypes";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function POST(request: Request) {
  const codes = new Set<string>(); 
  
  try {
    const { clientId, monthsBack = 6 } = await request.json();

    if (!Types.ObjectId.isValid(clientId)) {
        return NextResponse.json({ error: "Invalid Client ID" }, { status: 400 });
    }

    const clientObjectId = new Types.ObjectId(clientId);

    await connectToDatabase();

    const client = await Client.findById(clientObjectId);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    // --- 1. BUILD THE MAP FROM SOURCE CONFIGS ---
    const sourceConfigs = await SourceRewardConfig.find({
        "sponsorships.sponsoringClientId": clientObjectId
    }).lean<ISourceRewardConfig[]>();

    const achievementNames = sourceConfigs.map(sc => sc.achievementName);
    const Achievement = (await import("@/app/models/Achievement")).default;
    const achievementDocs = await Achievement.find({ name: { $in: achievementNames } }).lean<IAchievement[]>();
    
    const achievementNameToId = new Map<string, string>();
    for (const doc of achievementDocs) {
        achievementNameToId.set(doc.name, doc._id.toString());
    }

    const rewardIds = [];
    for (const config of sourceConfigs) {
        const sponsorship = config.sponsorships.find((s) => s.sponsoringClientId.toString() === clientId);
        if (sponsorship) rewardIds.push(sponsorship.rewardId);
    }

    const rewardDocs = await Reward.find({ _id: { $in: rewardIds } }).lean<IReward[]>();
    const rewardMap = new Map(rewardDocs.map((r) => [r._id.toString(), r]));

    const achievementDataMap = new Map<string, { reward: IReward, dataSourceId: Types.ObjectId }>();
    const targetAchievementIds: string[] = [];

    for (const config of sourceConfigs) {
        const achId = achievementNameToId.get(config.achievementName);
        if (!achId) continue;

        const sponsorship = config.sponsorships.find((s) => s.sponsoringClientId.toString() === clientId);
        if (!sponsorship) continue;

        const reward = rewardMap.get(sponsorship.rewardId.toString());
        if (!reward) continue;

        achievementDataMap.set(achId, {
            reward,
            dataSourceId: config.dataSourceId 
        });
        targetAchievementIds.push(achId);
    }
    
    if (targetAchievementIds.length === 0) {
         return NextResponse.json({ message: "No rewards configured for this client." });
    }
    
    const cutoffDate = DateTime.now().minus({ months: monthsBack }).toJSDate();

    // 2. Find Candidates 
    const users = await User.find({
      "stats.global.achievements.achievementId": { $in: targetAchievementIds }
    }).select('name email stats.global');

    // 3. Create the Stream
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        
        controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'START', 
            message: `Found ${users.length} potential users. Starting analysis...` 
        }) + '\n'));

        for (const user of users) {
          const session = await startSession();
          
          try {
            session.startTransaction();

            const globalStats = user.stats.get('global');
            
            if (!globalStats) {
                await session.commitTransaction(); 
                continue; 
            }

            const rewardsToAdd = [];
            const logs = [];

            for (const userAch of globalStats.achievements) {
                const achIdStr = userAch.achievementId.toString();

                if (!achievementDataMap.has(achIdStr)) continue;

                if (new Date(userAch.earnedAt) < cutoffDate) continue;

                const { reward: rewardConfig, dataSourceId } = achievementDataMap.get(achIdStr)!;

                // Rule 3: IDEMPOTENCY CHECK
                const alreadyHasIt = globalStats.rewards.some((r: any) => 
                    r.sponsoringClientId?.toString() === clientId && 
                    r.rewardId?.toString() === rewardConfig._id.toString()
                );

                if (alreadyHasIt) {
                    logs.push(`Skipped: Already has reward for ${userAch.name}`);
                    continue;
                }

                // --- CODE GENERATION LOGIC ---
                let code: string;
                let addedToPos = false;

                // Determine the correct software based on the reward category
                const category = rewardConfig.category || 'retail';
                const software = category === 'retail' ? client.retailSoftware : client.reservationSoftware;

                if (software === 'shopify') {
                    // FIX: Strictly enforce token check. Do NOT fallback to generic.
                    if (!client.shopify?.accessToken) {
                        logs.push(`Skipped: Missing Shopify Access Token for ${rewardConfig.friendlyName}`);
                        continue; 
                    }
                    
                    try {
                        const shopifyCode = await createShopifyDiscountCode(
                             new Types.ObjectId(rewardConfig._id),
                             client._id, 
                             { session }
                        );
                        if (!shopifyCode) throw new Error("Shopify returned null code");
                        code = shopifyCode;
                        addedToPos = true;
                    } catch (err: any) {
                        logs.push(`Error creating Shopify code: ${err.message}`);
                        continue; 
                    }
                } else if (software === 'none' || !software) {
                    // Only use generic codes if software is explicitly 'none'
                    code = await generateUniqueRewardCode(clientObjectId, codes, { session });
                } else {
                    logs.push(`Skipped: No generator found for software '${software}'`);
                    continue;
                }

                const newCodeDoc = await createRewardCodeInDB({
                    code,
                    userId: user._id,
                    clientId: clientObjectId,
                    achievementId: userAch.achievementId,
                    reward: rewardConfig, 
                    isGlobalReward: true,
                    redeemed: false,
                    addedToPos, // Track sync status
                    dataSourceId: new Types.ObjectId(dataSourceId) 
                }, { session });

                rewardsToAdd.push({
                    rewardId: rewardConfig._id,
                    rewardCodeId: newCodeDoc._id,
                    sponsoringClientId: clientId,
                    earnedAt: userAch.earnedAt,
                    triggeringEvent: userAch.triggeringEvent
                });
                
                logs.push(`SUCCESS: Issued ${rewardConfig.friendlyName} (${code})`);
            }

            if (rewardsToAdd.length > 0) {
                globalStats.rewards.push(...rewardsToAdd);
                await user.save({ session }); 
                
                await session.commitTransaction();

                controller.enqueue(encoder.encode(JSON.stringify({ 
                    type: 'UPDATE', 
                    status: 'success',
                    userName: user.name,
                    details: logs
                }) + '\n'));
            } else {
                await session.abortTransaction(); 
                controller.enqueue(encoder.encode(JSON.stringify({ 
                    type: 'UPDATE', 
                    status: 'skipped',
                    userName: user.name,
                    details: logs.length > 0 ? logs : ["No eligible achievements"]
                }) + '\n'));
            }

          } catch (err: any) {
             await session.abortTransaction();
             controller.enqueue(encoder.encode(JSON.stringify({ 
                type: 'UPDATE', 
                status: 'error',
                userName: user.name,
                error: err.message
             }) + '\n'));
          } finally {
            session.endSession();
          }
          
          await sleep(50); 
        }
        
        await Client.findByIdAndUpdate(clientId, { needsRetroactiveSweep: false });
        
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'DONE' }) + '\n'));
        controller.close();
      }
    });

    return new NextResponse(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}