import {
  USER_PROFILE_CLIENT,
  type UserProfileClient,
} from '@/domain/ports/user-profile-client.port';
import { Inject, Injectable, Logger } from '@nestjs/common';

export type ResolvedUserProfileIdentity = {
  fullName?: string;
  username?: string;
  profileStatus?: 'available' | 'unavailable';
};

@Injectable()
export class UserProfileResolverService {
  private readonly logger = new Logger(UserProfileResolverService.name);

  constructor(
    @Inject(USER_PROFILE_CLIENT)
    private readonly userProfileClient: UserProfileClient,
  ) {}

  async resolve(userId: string): Promise<ResolvedUserProfileIdentity> {
    try {
      const profile = await this.userProfileClient.getProfile({ userId });
      return {
        fullName: profile.fullName?.trim() || undefined,
        username: profile.username?.trim() || undefined,
        profileStatus: 'available',
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Unable to resolve profile identity for user ${userId}: ${reason}`,
      );
      return { profileStatus: 'unavailable' };
    }
  }
}
