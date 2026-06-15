import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  USER_PROFILE_REPOSITORY,
  type UserProfileRepository,
} from '../../domain/repositories/user-profile.repository';
import { AuthAdminHttpClient } from '../../integrations/auth/auth-admin-http.client';

@Injectable()
export class ManageUsersAdminUseCase {
  private readonly logger = new Logger(ManageUsersAdminUseCase.name);

  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly repository: UserProfileRepository,
    private readonly authAdminClient: AuthAdminHttpClient,
  ) {}

  async list(authorization: string) {
    const [accounts, profiles] = await Promise.all([
      this.authAdminClient.listUsers(authorization),
      this.repository.list({ limit: 1000, offset: 0 }),
    ]);
    const profilesByUserId = new Map(profiles.items.map((profile) => [profile.userId, profile]));
    return accounts.map((account) => {
      const profile = profilesByUserId.get(account.id);
      return {
        ...account,
        avatarUrl: profile?.avatarUrl ?? null,
        bio: profile?.bio ?? null,
        displayName: profile?.displayName ?? null,
        fullName: profile?.fullName ?? null,
        username: profile?.username ?? null,
      };
    });
  }

  async anonymize(actorId: string, userId: string, authorization: string): Promise<void> {
    await this.authAdminClient.deactivateUser(userId, authorization);
    await this.repository.anonymize(userId);
    this.logger.log(`admin_action=anonymize_user actorId=${actorId} userId=${userId}`);
  }
}
