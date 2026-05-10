import { Types, Document } from 'mongoose';

export const REWARD_PRODUCT_NAMES = ["open play", "reservations", "guest reservations", "classes and clinics", "pro shop", "online store", "in store", "custom"] as const;
export type RewardProductName = typeof REWARD_PRODUCT_NAMES[number];

export const REWARD_CATEGORY_NAMES = ["retail", "programming", "custom"] as const;
export type RewardCategoryName = typeof REWARD_CATEGORY_NAMES[number];

export const ADMIN_PERMISSION_TYPES = ["admin", "associate", null] as const;
export type AdminPermissionType = typeof ADMIN_PERMISSION_TYPES[number];


export type CommissionStatus =
  | 'pending'   // Waiting for day 30 check
  | 'held'      // Day 30 check found unresolved activity — re-check in 5 days
  | 'charged'   // Commission collected via Stripe
  | 'waived'    // Dispute lost or full refund — no commission taken
  | 'review';   // Still unresolved at day 60 — flagged for manual review

export interface ICommissionRecord extends Document {
  _id: Types.ObjectId;

  // Order context
  shopifyOrderId: string;        // Numeric Shopify order ID (e.g. "1234567890")
  shopifyOrderGid: string;       // GraphQL GID (e.g. "gid://shopify/Order/1234567890")
  shopDomain: string;            // e.g. "my-store.myshopify.com"
  discountCode: string;          // The GG code that was redeemed

  // Client link
  clientId: Types.ObjectId;      // Ref to Client

  // Financials
  orderTotal: number;            // Original order total in dollars
  refundedAmount: number;        // Total refunded at time of decision (0 if clean)
  commissionRate: number;        // 0.05 (stored explicitly in case rate changes later)
  commissionAmount: number;      // Calculated: (orderTotal - refundedAmount) * commissionRate

  // Scheduling
  orderCreatedAt: Date;          // When Shopify order was placed
  chargeAfter: Date;             // orderCreatedAt + 30 days — first eligible check date
  nextCheckAt: Date;             // Updated every time a held record is re-queued
  lastCheckedAt?: Date;          // When the cron last evaluated this record

  // Status
  status: CommissionStatus;
  stripePaymentIntentId?: string; // Set when status → 'charged'
  reviewNote?: string;            // Set when status → 'review'

  createdAt: Date;
  updatedAt: Date;
}

export interface AchievementEarned {
  key: string;
  repeatable: boolean;
};

export interface AchievementData {
  achievementId: Types.ObjectId;
  name: string;
  earnedAt: Date;
  count?: number;
  triggeringEvent?: string;
}

export interface RewardData {
  rewardId: Types.ObjectId;
  earnedAt: Date;
  redeemed: boolean;
  redemptionDate?: Date;
  rewardCodeId?: Types.ObjectId;
  sponsoringClientId?: Types.ObjectId;
  triggeringEvent?: string;
}

export interface ClientStats {
  visits?: Date[];
  lastVisit?: Date;
  wins?: number;
  losses?: number;
  winStreak?: number;
  pointsWon?: number;
  // matches?: Types.ObjectId[];
  achievements: AchievementData[];
  rewards: RewardData[];
}

export interface IDupr {
  id?: string;
  rating?: number;
  unverfiedId?: string;
  email?: string;
  activated?: boolean;
  userToken?: string;
  refreshToken?: string;
  hasBasicEntitlement?: boolean      // BASIC_L1
  hasPremiumEntitlement?: boolean    // PREMIUM_L1 (DUPR+)
  hasVerifiedEntitlement?: boolean   // VERIFIED_L1
  entitlementCheckedAt?: Date;
  doublesRating?: number;
  singlesRating?: number;
  doublesCareerHigh?:number;
  singlesCareerHigh?: number;
  doublesProvisional?: boolean;
  singlesProvisional?: boolean;
  lastRatingUpdate?: Date;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  accountClaimed: boolean;
  name: string;
  auth0Id?: string;
  superAdmin?: string;
  email?: string;
  dupr?: IDupr;
  profilePicture?: string;
  lastLocation?: Types.ObjectId;
  stats: Map<string,ClientStats>;
}

export type ResolvedUser = {
  id: string
  name: string
  email?: string
  isGuest: boolean
  duprId?: string
  superAdmin?: boolean
  permission?: AdminPermissionType;
  adminLocationId?: string | null;
  accountClaimed?: boolean;
}

export interface IMatch extends Document {
  _id: Types.ObjectId;
  dataSourceId: Types.ObjectId;
  duprMatchId?: number;
  duprGameNumber?: number;
  processedUsers?: Types.ObjectId;
  matchDate: Date;
  matchId?: number;
  team1: {
    players: Types.ObjectId[]; 
    score: number;
  };
  team2: {
    players: Types.ObjectId[];
    score: number;
  };
  winners: Types.ObjectId[];
  location?: Types.ObjectId;
  logToDupr: boolean;
}

// Player as the admin enters them. Email is optional; DUPR ID is the key field.
export interface IUploadedMatchPlayer {
  name: string;
  email?: string;
  duprId: string;
}

// Mirrors DUPR's payload shape: two players + 5 fixed game score slots (0 for unplayed).
// Keeping this shape identical to DUPR means submission is a near-passthrough.
export interface IUploadedMatchTeam {
  player1: IUploadedMatchPlayer;
  player2: IUploadedMatchPlayer;
  game1: number;
  game2: number;
  game3: number;
  game4: number;
  game5: number;
}

export type ClubEventType = 'past' | 'upcoming';
export type ClubEventAccessLevel = 'open' | 'dupr_plus';

export interface IClubEvent extends Document {
  _id: Types.ObjectId;
  club: Types.ObjectId;
  createdByAdmin: Types.ObjectId;
  name: string;
  eventDate: Date;
  notes?: string;
  eventType: ClubEventType;
  accessLevel: ClubEventAccessLevel;
  location?: string;
  description?: string;
  registrationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type EventRegistrationStatus = 'registered' | 'cancelled';

export interface IEventRegistration extends Document {
  _id: Types.ObjectId;
  event: Types.ObjectId;
  user: Types.ObjectId;
  name: string;
  email?: string;
  duprId: string;
  duprPlusVerifiedAtRegistration: boolean;
  status: EventRegistrationStatus;
  registeredAt: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type DuprSubmissionStatus = 'draft' | 'pending' | 'submitted' | 'failed';

export interface IClubUploadedMatch extends Document {
  _id: Types.ObjectId;
  club: Types.ObjectId;
  event?: Types.ObjectId;
  createdByAdmin: Types.ObjectId;

  matchDate: Date;
  teamA: IUploadedMatchTeam;
  teamB: IUploadedMatchTeam;
  location?: string;
  notes?: string;

  duprSubmissionStatus: DuprSubmissionStatus;
  duprMatchId?: string; // returned by DUPR; join key for sync-back
  duprSubmissionError?: string;
  submittedAt?: Date;

  deletedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}


export interface IDuprImportError extends Document {
  importJobId?: Types.ObjectId;
  duprMatchId?: string;
  duprId?: string;
  playerName?: string;
  errorType: 'validation' | 'processing';
  reason: string;
  rawData?: any;
  createdAt: Date;
  updatedAt: Date;
}

export type SerializedAchievement = {
  _id: string;
  index: number;
  name: string;
  friendlyName: string;
  badge: string;
};

export interface IAchievement extends Document {
  _id: Types.ObjectId;
  index: number;
  categoryId: Types.ObjectId;
  friendlyName: string;
  task: string;
  name: string;
  badge: string;
}

export interface IAchievementCategory extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  milestones?: string[];
  scope?: "local" | "global"
}


export interface IReward extends Document {
  _id: Types.ObjectId;
  index: number;
  repeatable?: boolean;
  name: string;
  friendlyName: string;
  product: RewardProductName;
  productDescription?: string;
  discount?: number;
  minimumSpend?: number;
  maxDiscount?: number;
  type?: "dollars" | "percent";
  category: RewardCategoryName;
}

export interface ShopifyData {
  shopDomain: string;
  accessToken: string;
  secret: string;
}

export interface PodplayData {
  accessToken: string;
}

export interface PlayByPointData {
  facilityId: number | undefined;
  affiliations: string[];
}

export interface DuprData {
  id: string;
}

export interface IClub extends Document {
  _id: Types.ObjectId;
  name: string;
  admins: { user: Types.ObjectId; duprRole: 'ORGANIZER' | 'DIRECTOR' }[];
  duprClubId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IClient extends Document {
  _id: Types.ObjectId;
  active?: boolean;
  locationType?: boolean;
  dupr?: DuprData;
  name: string;
  latitude: number;
  longitude: number;
  logo: string;
  cardBackgroundImage?: string;
  cardTextColor: string;
  rewardProducts: string[];
  admin_logo: string;
  bannerColor: string;
  icon: string;
  hasConfiguredRewards?: boolean;
  altAchievements?: Types.ObjectId[];
  altRewardsPerAchievement?: Map<string, Types.ObjectId | IReward>;

  // altRewardsPerAchievement?: {
    // [achievementId: string]: IReward;
  // };

  achievements?: Types.ObjectId[];
  rewardsPerAchievement?: Map<string, Types.ObjectId | IReward>;

  // rewardsPerAchievement?: {
    // [achievementId: string]: IReward;
  // };
  
  retailSoftware: "shopify" | "playbypoint" | undefined;
  reservationSoftware: "playbypoint" | "podplay" | "courtreserve" | undefined;
  rewardConfigStatus?: "pending" | "active";
  shopify?: ShopifyData;
  playbypoint?: PlayByPointData;
  podplay?: PodplayData;
  needsRetroactiveSweep: boolean;
}

export interface IAdmin extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  location: Types.ObjectId;
  permission: AdminPermissionType;
  clientName: string;
  name: string;
}

export interface IRewardCode {
  _id: Types.ObjectId;
  code: string;
  userId?: Types.ObjectId;
  clientId: Types.ObjectId;
  achievementId: Types.ObjectId;
  reward: IReward;
  redeemed: boolean;
  redemptionDate?: Date;
  addedToPos?: boolean;
  createdAt: Date;
  dataSourceId?: Types.ObjectId;
  isGlobalReward: boolean;
}

export interface IGGRConfigSponsorship {
  sponsoringClientId: Types.ObjectId;
  rewardId: Types.ObjectId;
}

export interface IGGRConfig {
  _id: Types.ObjectId;
  globalRewardConfig: Map<string, IGGRConfigSponsorship[]>;
  createdAt: string;
  updatedAt: string;
}

export interface IDataSourceCredentials {
  apiKey?: string;
  apiSecret?: string;
}

export interface IDataSource {
  _id: Types.ObjectId;
  name: string;
  type: 'dupr' | 'silly_pickles' | 'swish'; 
  logo: string;
  icon: string;
  credentials?: IDataSourceCredentials;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISourceRewardSponsorship {
  sponsoringClientId: Types.ObjectId;
  rewardId: Types.ObjectId;
}

export interface ISourceRewardConfig {
  _id: Types.ObjectId;
  dataSourceId: Types.ObjectId;
  achievementName: string; // e.g., "5-dupr-matches-won"
  sponsorships: ISourceRewardSponsorship[];
  createdAt: Date;
  updatedAt: Date;
}