export interface Auth0User {
  user_id: string;
  email: string;
  email_verified: boolean;
  name: string;
  created_at: string;
  updated_at: string;
  username?: string;
  phone_number?: string;
  phone_verified?: boolean;
}