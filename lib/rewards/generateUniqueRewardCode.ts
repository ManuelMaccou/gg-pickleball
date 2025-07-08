import crypto from 'crypto';
import RewardCode from '@/app/models/RewardCode';
import { Types } from 'mongoose';

/**
 * Generate a unique reward code that doesn't exist in the DB or the local Set
 * @param clientId - Mongo ObjectId for the client
 * @param existingCodes - Set of codes already generated in this batch
 */
export async function generateUniqueRewardCode(
  clientId: Types.ObjectId,
  existingCodes: Set<string>
): Promise<string> {
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    const code = crypto.randomBytes(6)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 6)
      .toUpperCase();

    if (existingCodes.has(code)) continue;

    const exists = await RewardCode.exists({ code, clientId });
    if (!exists) {
      existingCodes.add(code);
      return code;
    }
  }

  throw new Error('Failed to generate a unique reward code after multiple attempts');
}
