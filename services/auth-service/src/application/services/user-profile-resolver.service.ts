import { UserProfilesGrpcService } from '@/modules/identity/user-profiles-grpc.service';
import { Injectable, Logger } from '@nestjs/common';

export type ResolvedUserProfileIdentity = {
  fullName?: string;
  username?: string;
  profileStatus?: 'available' | 'unavailable';
};

@Injectable()
export class UserProfileResolverService {
  private readonly logger = new Logger(UserProfileResolverService.name);

  constructor(
    private readonly userProfilesGrpcService: UserProfilesGrpcService,
  ) {}

  async resolve(userId: string): Promise<ResolvedUserProfileIdentity> {
    try {
      const profile = await this.userProfilesGrpcService.getProfile({ userId });
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
