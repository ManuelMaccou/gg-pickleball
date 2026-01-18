export interface ClientSideSponsorship {
  sponsoringClientId: string;
  rewardId: string;
}

export interface ClientSideGGRConfig {
  _id: string;
  globalRewardConfig: Map<string, ClientSideSponsorship[]>;
  createdAt: string;
  updatedAt: string;
}