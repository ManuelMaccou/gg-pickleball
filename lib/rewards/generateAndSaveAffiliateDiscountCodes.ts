import { ClientSession, Types } from 'mongoose';
import Client from '@/app/models/Client';
import { RewardCodeTask } from '@/app/types/rewardTypes';
import { createRewardCodeInDB } from './createRewardCodeInDB';
import { logRewardEvent, LogContext } from './rewardProcessingLogger';

interface GeneratorOptions {
  session: ClientSession;
  errors?: Set<string>;
  logContext?: LogContext;
}

// The client hands us one pre-generated code tied to their own affiliate
// program. We never mint anything — every earner gets the same stored
// string, and RewardCode.redeemed stays false forever for these rows
// since there's no webhook to ever flip it. That's correct, not a gap:
// we have no way to know the code was used, and it never expires on our
// side. See Requirements-doc-equivalent notes before touching this again.
export const generateAndSaveAffiliateDiscountCodes = async (
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId,
  { session, errors, logContext }: GeneratorOptions
): Promise<Map<string, Types.ObjectId>> => {
  const map = new Map<string, Types.ObjectId>();

  const client = await Client.findById(clientId).session(session);
  if (!client?.affiliateCode) {
    console.warn(`[generateAndSaveAffiliateDiscountCodes] Client ${clientId} has no affiliateCode configured — skipping ${tasks.length} task(s).`);
    errors?.add('missing-affiliate-code');
    if (logContext) {
      logRewardEvent({
        context: logContext,
        level: 'error',
        category: 'generator',
        message: `Client ${clientId} has no affiliateCode configured`,
        metadata: { clientId: clientId.toString(), taskCount: tasks.length },
      }).catch(() => {});
    }
    return map;
  }

  for (const task of tasks) {
    try {
      const doc = await createRewardCodeInDB(
        {
          code: client.affiliateCode,
          userId: task.userId,
          clientId: task.clientId,
          achievementId: task.achievementId,
          reward: task.reward,
          isGlobalReward: task.isGlobalReward,
        },
        { session }
      );
      map.set(task.reward._id.toString(), doc._id);
    } catch (err) {
      console.error(`[generateAndSaveAffiliateDiscountCodes] Failed to save reward code for user ${task.userId}:`, err);
      errors?.add('affiliate-code-save-failed');
    }
  }

  return map;
};