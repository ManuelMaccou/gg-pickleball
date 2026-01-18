import crypto from 'crypto';
import RewardCode from '@/app/models/RewardCode';
import { ClientSession, Types } from 'mongoose';

/**
 * Generate a unique reward code that doesn't exist in the DB or the local Set
 * @param clientId - Mongo ObjectId for the client
 * @param existingCodes - Set of codes already generated in this batch
 */

type RequiredDbOptions = { session: ClientSession };

export async function generateUniqueRewardCode(
  clientId: Types.ObjectId,
  existingCodes: Set<string>,
  dbOptions: RequiredDbOptions
): Promise<string> {
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
     const randomPart = crypto.randomBytes(4)
        .toString('hex')
        .toUpperCase()
        .substring(0, 6);
    
      const code = `GG${randomPart}`;

    if (existingCodes.has(code)) continue;

    const exists = await RewardCode.exists({ code, clientId })
      .session(dbOptions.session);
      
    if (!exists) {
      existingCodes.add(code);
      return code;
    }
  }

  throw new Error('Failed to generate a unique reward code after multiple attempts');
}
