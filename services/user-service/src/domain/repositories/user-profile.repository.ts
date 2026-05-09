import { UserProfile } from '../entities/user-profile.entity';

export const USER_PROFILE_REPOSITORY = Symbol('USER_PROFILE_REPOSITORY');

export type CreatePendingUserProfileInput = {
  fullName: string;
  userId: string;
};

export interface UserProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  markEmailVerified(userId: string): Promise<UserProfile>;
  upsertPending(input: CreatePendingUserProfileInput): Promise<UserProfile>;
}
