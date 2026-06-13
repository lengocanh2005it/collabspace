import { ChangePasswordRequestDto } from '@/application/dto/auth-request.dto';
import { ChangePasswordResult } from '@/common/types/identity.type';
import { IdentityService } from '@/modules/identity/identity.service';
import { RefreshTokensService } from '@/modules/refresh-tokens/refresh-tokens.service';
import { Injectable } from '@nestjs/common';
import { JwtTokenService } from '../services/jwt-token.service';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly identityService: IdentityService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async execute(
    authorizationHeader: string | undefined,
    input: ChangePasswordRequestDto,
  ): Promise<ChangePasswordResult> {
    const { userId } =
      await this.jwtTokenService.resolveVerifiedUserContext(authorizationHeader);
    await this.identityService.changePassword(
      userId,
      input.currentPassword,
      input.newPassword,
    );
    const revokedSessionCount = await this.refreshTokensService.revokeAllForUser(
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
