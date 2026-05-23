// lib/admin/createBrandClient.ts
//
// Creates a new Client document with the defaults a brand needs to get
// through onboarding. Used by the public signup flow.

import Client from '@/app/models/Client';

interface CreateBrandClientParams {
  name: string;
}

export async function createBrandClient({ name }: CreateBrandClientParams) {
  const cleanName = name.trim();

  // Check for name collision (Client.name has a unique index)
  const existing = await Client.findOne({ name: cleanName });
  if (existing) {
    throw new Error('A brand with this name is already registered.');
  }

  const client = await Client.create({
    name: cleanName,
    retailSoftware: 'shopify',
    rewardProducts: ['online store'],
    // All other required-with-default fields are filled by schema defaults:
    // active=false, locationType='facility', cardTextColor='#ffffff',
    // bannerColor='white', rewardConfigStatus='active', needsRetroactiveSweep=true
  });

  return client;
}