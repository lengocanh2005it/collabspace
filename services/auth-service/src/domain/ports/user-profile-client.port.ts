export const USER_PROFILE_CLIENT = Symbol('USER_PROFILE_CLIENT');

export type UserProfileSnapshot = {
  fullName?: string;
  userId: string;
  username?: string;
};

export type CreatePendingProfileInput = {
  email?: string;
  fullName: string;
  userId: string;
};

export interface UserProfileClient {
  createPendingProfile(input: CreatePendingProfileInput): Promise<void>;
  getProfile(input: { userId: string }): Promise<UserProfileSnapshot>;
  ping(): Promise<void>;
}
