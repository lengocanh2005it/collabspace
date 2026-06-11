export const USER_PROFILE_UPDATED_EVENT = "user_profile_updated";

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
