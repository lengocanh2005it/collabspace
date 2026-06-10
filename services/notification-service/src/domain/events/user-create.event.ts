export const USER_REGISTERED_EVENT = "user_registered";

export interface UserRegisteredEventPayload {
  userId: string;
  fullName: string;
  email?: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  occurredAt?: string;
}
