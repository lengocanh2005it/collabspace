import type { AuthSessionSummaryResult } from '@/application/dto/auth-use-case-results';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '@/domain/repositories/refresh-token.repository';
import { Inject, Injectable } from '@nestjs/common';
import { JwtTokenService } from '../services/jwt-token.service';

@Injectable()
export class ListSessionsUseCase {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(authorizationHeader: string | undefined): Promise<AuthSessionSummaryResult[]> {
    const { userId } = await this.jwtTokenService.resolveVerifiedUserContext(authorizationHeader);
    const sessions = await this.refreshTokenRepository.listSessionsByUserId(userId);

    return sessions.map((session) => ({
      tokenId: session.tokenId,
      familyId: session.familyId,
      userId: session.userId,
      workspaceId: session.workspaceId,
      isActive: session.isActive,
      lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() ?? null,
    }));
  }
}
