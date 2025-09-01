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

  const productToKindsMap: { [key: string]: Kind[] } = {
    'open play': [Kind.Clinic],
    'reservation': [Kind.Reservation],
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

      if (task.reward.product !== 'pro shop') {
        const data: IRewardCode = await response.json();
        result.set(task.reward._id.toString(), data._id);

        const expiration = new Date();
        expiration.setFullYear(expiration.getFullYear() + 1);

        const kinds = productToKindsMap[task.reward.product] ?? [];
        console.log("kinds:", kinds)
        console.log("task.reward.product:", task.reward.product)
        
        if (!client.playbypoint || !client.playbypoint.facilityId) {
          throw new Error(`Missing PlayByPoint facility ID for client ${clientId}`);
        }
        const facilityId = client.playbypoint.facilityId.toString();

        const discount = task.reward.discount;
        if (discount == null) { // `== null` safely checks for both null and undefined
          console.error(`CRITICAL ERROR: A reward without a discount was passed to the PlayByPoint coupon generator. Skipping. Reward name: ${task.reward.name}`);
          continue; // Skip this iteration
        }
  
        const pbpCoupon: CouponInput = {
          facilityId,
          codeName: code,
          description: task.reward.name,
          discountAmount: discount,
          percentual: task.reward.type === 'percent',
          quantity: 1,
          periodicityValue: 1,
          enabled: true,
          paymentMethods: [PaymentMethod.All],
          affiliations: pbpAffiliations,
          periodicityUnit: 'p_times',
          kinds: kinds,
          expirationDate: expiration.toISOString().slice(0, 10),
        };

        couponsForPbp.push(pbpCoupon);
      }
    } catch (err) {
      console.error(`Error generating local reward code for ${task.reward.name ?? 'unknown'}:`, err);
    }
  }

 if (couponsForPbp.length > 0) {
    console.log(`Triggering background task to add ${couponsForPbp.length} coupons to PlayByPoint.`);

    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/pbp/create-discount/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupons: couponsForPbp }),
    })
    .then(async (response) => {
      // This part is correct: It handles network or server-level failures.
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Could not parse error JSON.' }));
        console.error(`[Background Task] Batch coupon creation failed with HTTP status ${response.status}:`, errorBody);
        return;
      }
      
      const successBody = await response.json();

      // --- THIS IS THE CRITICAL FIX ---
      // We must now inspect the `results` array within the successful response.
      if (!Array.isArray(successBody.results)) {
        console.error('[Background Task] Batch response was successful, but the `results` key is missing or not an array.', successBody);
        return;
      }

      let allSucceeded = true;
      // Iterate through each result in the batch to check its individual status.
      for (const result of successBody.results) {
        // A successful status from the PBP batch API is typically 200-299.
        // We check for any status that indicates an error (400 or higher).
        if (result.status >= 400) {
          allSucceeded = false;
          // Log this specific failure as a high-priority error.
          console.error(`[Background Task] Coupon creation FAILED for code '${result.codeName}'. Status: ${result.status}. Body:`, result.body);
        }
      }

      // Now, log the final, accurate outcome of the entire batch operation.
      if (allSucceeded) {
        console.log('[Background Task] Successfully completed batch coupon creation in PlayByPoint. All coupons were created.');
      } else {
        // This is a more accurate message than the success message you saw before.
        console.warn('[Background Task] Batch coupon creation completed, but one or more coupons failed. See individual errors above.');
      }
      
    })
    .catch((err) => {
      console.error('[Background Task] A critical error occurred during the PlayByPoint batch update fetch call:', err);
    });
  }

  return result;
}