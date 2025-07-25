export enum PaymentMethod {
  Card = 'card',
  Cash = 'cash',
  ClubCredit = 'club_credit',
  ClubAccount = 'club_account',
  All = 'all',
}

export enum Kind {
  Reservation = 'reservation',
  Rental = 'rental',
  Lesson = 'lesson',
  Clinic = 'clinic', // aka 'program' on the front end
  UserPackage = 'user_package',
  Membership = 'membership',
  All = 'all',
}

export interface CouponInput {
  facilityId: string;
  codeName: string;
  quantity: number;
  description?: string;
  discountAmount: number;
  percentual: boolean;
  enabled: boolean;
  expirationDate: string; // ISO 8601
  affiliations: string[];
  paymentMethods: PaymentMethod[];
  kinds: Kind[];
  periodicityUnit: string;
  periodicityValue: number;
  ageStart?: number | null;
  ageEnd?: number | null;
}

