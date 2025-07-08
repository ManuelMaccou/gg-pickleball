import { Types } from 'mongoose';
import { IClient, IReward, IRewardCode } from '@/app/types/databaseTypes';
import { generateUniqueRewardCode } from './generateUniqueRewardCode';
import { CouponInput, Kind, PaymentMethod } from '@/app/types/pbpTypes';
import Client from '@/app/models/Client';

export interface RewardCodeTask {
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  reward: IReward;
  clientId: Types.ObjectId;
}

export async function generateAndSavePlayByPointDiscountCodes(
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId
): Promise<Map<string, Types.ObjectId>> {
  const result = new Map<string, Types.ObjectId>();
  const codes = new Set<string>();
  const couponsForPbp: CouponInput[] = [];

  if (!process.env.NEXT_PUBLIC_BASE_URL || !process.env.INTERNAL_API_KEY) {
    throw new Error('Missing required environment variables for reward code creation');
  }

  const client: IClient | null = await Client.findById(clientId);
  if (!client) {
    throw new Error(`Client with ID ${clientId} not found. Cannot create PBP coupons.`);
  }

  const allKinds: Kind[] = [
    Kind.Reservation,
    Kind.Membership,
    Kind.Rental,
    Kind.Lesson,
    Kind.Clinic,
    Kind.UserPackage,
  ];

  const productToKindsMap: { [key: string]: Kind[] } = {
    'open play': [Kind.Clinic],
    'reservation': [Kind.Reservation],
    'pro shop': allKinds,
  };

  const pbpAffiliations = client.playbypoint?.affiliations ?? [];

  for (const task of tasks) {
    try {
      const code = await generateUniqueRewardCode(clientId, codes);

      const payload: Partial<IRewardCode> = {
        code,
        userId: task.userId,
        clientId: clientId,
        achievementId: task.achievementId,
        reward: task.reward,
        addedToPos: false,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/reward-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.INTERNAL_API_KEY ?? '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create reward code');
      }

      const data: IRewardCode = await response.json();
      result.set(task.reward._id.toString(), data._id);

      const expiration = new Date();
      expiration.setFullYear(expiration.getFullYear() + 1);

      const kinds = productToKindsMap[task.reward.product] ?? [];
 
      const pbpCoupon: CouponInput = {
        codeName: code,
        description: task.reward.name,
        discountAmount: task.reward.discount,
        percentual: task.reward.type === 'percent',
        quantity: 1, // Each unique code should have a quantity of 1
        periodicityValue: 1, // Each code can be used 1 time per user
        enabled: true,
        paymentMethods: [PaymentMethod.All],
        affiliations: pbpAffiliations,
        periodicityUnit: 'p_times',
        kinds: kinds,
        expirationDate: expiration.toISOString().slice(0, 10),
      };

      couponsForPbp.push(pbpCoupon);

    } catch (err) {
      console.error(`Error generating local reward code for ${task.reward.name ?? 'unknown'}:`, err);
    }
  }

  if (couponsForPbp.length > 0) {
    console.log(`Triggering background task to add ${couponsForPbp.length} coupons to PlayByPoint.`);
    console.log('Body:', couponsForPbp);

    

    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/pbp/update-discount/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupons: couponsForPbp }),
    })
    .then(async (response) => {
      if (!response.ok) {
        // If the API returns an error (e.g., 400 or 500), log it.
        const errorBody = await response.json().catch(() => ({ message: 'Could not parse error JSON.' }));
        console.error(`[Background Task] Batch coupon creation failed with status ${response.status}:`, errorBody);
        return; // Stop processing
      }
      const successBody = await response.json();
      console.log('[Background Task] Successfully completed batch coupon creation in PlayByPoint.', successBody.results);
      // Here you could trigger another background task to update the `addedToPos: true` flag in your DB.
    })
    .catch((err) => {
      // This catches network errors or other issues with the fetch call itself.
      console.error('[Background Task] A critical error occurred during the PlayByPoint batch update fetch call:', err);
    });
  }

  // The function returns the map of saved codes without waiting for the batch update to finish.
  return result;
}