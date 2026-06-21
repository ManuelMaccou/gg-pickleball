import { ClientSession, Types } from 'mongoose';
import { generateAndSaveShopifyDiscountCodes } from './generateAndSaveShopifyDiscountCodes';
import { RewardCodeTask } from '@/app/types/rewardTypes';
import { generateAndSavePodPlayDiscountCodes } from './generateAndSavePodplayDiscountCodes';
import { generateAndSavePlayByPointDiscountCodes } from './generateAndSavePlayByPointDiscountCodes';
import { generateAndSaveCustomDiscountCodes } from './generateAndSaveCustomDiscountCodes';
import { LogContext } from './rewardProcessingLogger';

interface GeneratorOptions {
  session: ClientSession;
  errors?: Set<string>;
  logContext?: LogContext;
}

export type RewardCodeGenerator = (
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId,
  options: GeneratorOptions
) => Promise<Map<string, Types.ObjectId>>;

const rewardCodeGenerators: Record<string, RewardCodeGenerator> = {
  'retail:shopify': generateAndSaveShopifyDiscountCodes,
  'programming:podplay': generateAndSavePodPlayDiscountCodes,
  'retail:playbypoint': generateAndSavePlayByPointDiscountCodes,
  'programming:playbypoint': generateAndSavePlayByPointDiscountCodes,
};

export function getRewardCodeGenerator(category: string, software?: string): RewardCodeGenerator | undefined {
  if (category === 'custom') {
    return generateAndSaveCustomDiscountCodes;
  }

  if (!software) {
    console.warn(`Cannot get reward generator for category "${category}" without a configured software.`);
    return undefined;
  }

  return rewardCodeGenerators[`${category}:${software}`];
}
