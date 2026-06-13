import { ChangePasswordRequestDto } from '@/application/dto/auth-request.dto';
import type { ChangePasswordResult } from '@/application/dto/auth-use-case-results';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '@/domain/repositories/refresh-token.repository';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { Inject, Injectable } from '@nestjs/common';
import { JwtTokenService } from '../services/jwt-token.service';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly jwtTokenService: JwtTokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(
    authorizationHeader: string | undefined,
    input: ChangePasswordRequestDto,
  ): Promise<ChangePasswordResult> {
    const { userId } =
      await this.jwtTokenService.resolveVerifiedUserContext(authorizationHeader);
    await this.userRepository.changePassword(
      userId,
      input.currentPassword,
      input.newPassword,
    );
    const revokedSessionCount = await this.refreshTokenRepository.revokeAllForUser(
      userId,
      'password_changed',
    );

    return {
      changed: true,
      revokedSessionCount,
      userId,
    };
  }
}
