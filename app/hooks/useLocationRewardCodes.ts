import useSWR from 'swr';
import { IRewardCode } from '@/app/types/databaseTypes';
import { Types } from 'mongoose';

// The fetcher function is a simple wrapper around fetch
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error('An error occurred while fetching the data.');
  }
  return res.json();
});

export function useLocationRewardCodes(locationId: Types.ObjectId | string | undefined) {
  // The key can be a string or null. If it's null, SWR will not start fetching.
  const key = locationId ? `/api/reward-code/location?locationId=${locationId}` : null;
  
  const { data, error, isLoading, mutate } = useSWR<{ rewardCodes: IRewardCode[] }>(key, fetcher);

  return {
    rewardCodes: data?.rewardCodes,
    isLoading,
    isError: error,
    mutate // We export `mutate` to trigger re-fetches from our component
  };
}