import { LoginRequestDto } from '@/application/dto/auth-request.dto';
import type { AuthSessionResponseDto } from '@/application/dto/auth-session-response.dto';
import { User } from '@/domain/entities/user.entity';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SessionIssuanceService } from '../services/session-issuance.service';
import {
  AUTH_ADMIN_REPOSITORY,
  type AuthAdminRepository,
} from '@/domain/repositories/auth-admin.repository';

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(AUTH_ADMIN_REPOSITORY)
    private readonly authAdminRepository: AuthAdminRepository,
    private readonly sessionIssuanceService: SessionIssuanceService,
  ) {}

  async execute(input: LoginRequestDto): Promise<AuthSessionResponseDto> {
    const authUser = await this.userRepository.validateCredentials(input);
    User.fromAuthUser(authUser).assertCanLogin();
    const session = await this.sessionIssuanceService.issue(authUser, input.workspaceId);
    try {
      await this.authAdminRepository.recordLogin(authUser.userId);
    } catch (error) {
      this.logger.warn(
        `Unable to record last login for userId=${authUser.userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return session;
  }
}
