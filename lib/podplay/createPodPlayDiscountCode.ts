import axios from 'axios';
import crypto from 'crypto';
import Reward from '@/app/models/Reward';
import { IReward } from '@/app/types/databaseTypes';
import { Types } from 'mongoose';

const PODPLAY_API_URL = 'https://powerplay.podplay.app/apis/v2/coupons';
const PODPLAY_API_KEY = process.env.PODPLAY_API_KEY; // Set in .env

const eligibleTypeMap: Record<string, 'BOOKING' | 'EVENT_OPEN_PLAY'> = {
  'reservation': 'BOOKING',
  'open play': 'EVENT_OPEN_PLAY',
};

export async function createPodPlayDiscountCode(rewardId: Types.ObjectId): Promise<string | null> {
  const code = crypto.randomBytes(6)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 6)
      .toUpperCase();
      
  try {
    const reward: IReward | null = await Reward.findById(rewardId);
    if (!reward) {
      throw new Error(`Reward not found with id ${rewardId}`);
    }

    const discountDescription = `${reward.friendlyName?.trim() || ''} ${reward.product?.trim() || ''}`;
    const cleanDescription = discountDescription.trim();

    const eligibleType = eligibleTypeMap[reward.product?.toLowerCase() || ''];
    if (!eligibleType) {
      throw new Error(`Invalid or missing eligibleType for product: ${reward.product}`);
    }

    const value = reward.type === 'percent'
      ? reward.discount/100
      : reward.discount;

    const body = {
      id: reward._id.toString(),
      code,
      description: cleanDescription,
      discountType: reward.type === 'percent' ? 'PERCENT_OFF' : 'AMOUNT_OFF',
      value,
      ticketsLeft: 1,
      active: true,
      startDate: new Date().toISOString(),
      eligibleType,
      eligibleUsers: {
        items: [],
        _total: 0,
        _links: {
          self: { href: '' },
        },
      },
      eligibleDomains: [],
      tags: ['SINGLE_USE'],
      allowedAreas: {
        items: [],
        _total: 0,
        _links: {
          self: { href: '' },
        },
      },
      _links: {},
    };

    const response = await axios.post(PODPLAY_API_URL, body, {
      headers: {
        Authorization: `Bearer ${PODPLAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status !== 201 && response.status !== 200) {
      throw new Error(`PodPlay API returned unexpected status: ${response.status}`);
    }

    console.log(`Discount created successfully: ${code}`);
  } catch (error) {
    console.error('Failed to create PodPlay discount:', error);
    throw error;
  }

  return code;
}
