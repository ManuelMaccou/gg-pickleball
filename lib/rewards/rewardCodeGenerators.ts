import { Types } from 'mongoose';
import { generateAndSaveShopifyDiscountCodes } from './generateAndSaveShopifyDiscountCodes';
import { RewardCodeTask } from '@/app/types/rewardTypes';
import { generateAndSavePodPlayDiscountCodes } from './generateAndSavePodplayDiscountCodes';

export type RewardCodeGenerator = (
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId
) => Promise<Map<string, Types.ObjectId>>;

const rewardCodeGenerators: Record<string, RewardCodeGenerator> = {
  'retail:shopify': generateAndSaveShopifyDiscountCodes,
  'programming:podplay': generateAndSavePodPlayDiscountCodes
  // 'retail:playbypoint': generateAndSavePlayByPointDiscountCodes, // future
  // 'programming:courtreserve': generateAndSaveCourtReserveCodes,
};

export function getRewardCodeGenerator(category: string, software: string): RewardCodeGenerator | undefined {
  return rewardCodeGenerators[`${category}:${software}`];
}
