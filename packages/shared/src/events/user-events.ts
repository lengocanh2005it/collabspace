export const USER_REGISTERED_EVENT = 'user_registered';
export const USER_PROFILE_UPDATED_EVENT = 'user_profile_updated';

export interface UserRegisteredEventPayload {
  userId: string;
  fullName: string;
  email?: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  occurredAt?: string;
}

export interface UserProfileUpdatedEventPayload {
  userId: string;
  fullName?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  username?: string | null;
  email?: string;
  isActive?: boolean;
  occurredAt?: string;
}
