import {
  IssueRefreshTokenInput,
  RefreshTokenPayload,
} from '@/common/types/refresh-token.type';
import { ConfigurationService } from '@/configuration/configuration.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { RefreshTokenEntity } from './entities/refresh-token.entity';

@Injectable()
export class RefreshTokensService {
  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly dataSource: DataSource,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
  ) {}

  async findActiveToken(
    refreshToken: string,
  ): Promise<RefreshTokenEntity | null> {
    const tokenHash = this.hashToken(refreshToken);

    return this.refreshTokenRepository.findOne({
      where: {
        expiresAt: MoreThan(new Date()),
        revokedAt: IsNull(),
        tokenHash,
      },
    });
  }

  async issue(input: IssueRefreshTokenInput): Promise<RefreshTokenPayload> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RefreshTokenEntity);
      const payload = this.buildTokenPayload(input);

      await repository.save(
        repository.create({
          expiresAt: payload.expiresAt,
          familyId: payload.familyId,
          id: payload.tokenId,
          lastUsedAt: null,
          parentTokenId: input.parentTokenId ?? null,
          replacedByTokenId: null,
          revokeReason: null,
          revokedAt: null,
          tokenHash: this.hashToken(payload.refreshToken),
          userId: payload.userId,
          workspaceId: payload.workspaceId ?? null,
        }),
      );

      return payload;
    });
  }

  async revokeFamily(
    familyId: string,
    reason = 'family_revoked',
  ): Promise<number> {
    const now = new Date();
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshTokenEntity)
      .set({
        revokeReason: reason,
        revokedAt: now,
      })
      .where('family_id = :familyId', { familyId })
      .andWhere('revoked_at IS NULL')
      .execute();

    return result.affected ?? 0;
  }

  async revokeToken(
    refreshToken: string,
    reason = 'manually_revoked',
  ): Promise<void> {
    const currentToken = await this.loadTokenByValue(refreshToken);

    if (!currentToken || currentToken.revokedAt) {
      return;
    }

    currentToken.revokedAt = new Date();
    currentToken.revokeReason = reason;
    currentToken.lastUsedAt = new Date();
    await this.refreshTokenRepository.save(currentToken);
  }

  async rotate(refreshToken: string): Promise<RefreshTokenPayload> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RefreshTokenEntity);
      const currentToken = await this.loadTokenByValue(
        refreshToken,
        repository,
      );

      if (!currentToken) {
        throw new UnauthorizedException({
          code: 'REFRESH_TOKEN_INVALID',
          message: 'Refresh token is invalid',
        });
      }

      if (this.isExpired(currentToken)) {
        currentToken.revokedAt = currentToken.revokedAt ?? new Date();
        currentToken.revokeReason = currentToken.revokeReason ?? 'expired';
        currentToken.lastUsedAt = new Date();
        await repository.save(currentToken);

        throw new UnauthorizedException({
          code: 'REFRESH_TOKEN_EXPIRED',
          message: 'Refresh token has expired',
        });
      }

      if (currentToken.revokedAt || currentToken.replacedByTokenId) {
        await this.revokeFamilyWithRepository(
          repository,
          currentToken.familyId,
          'token_reuse_detected',
        );

        throw new UnauthorizedException({
          code: 'REFRESH_TOKEN_REUSED',
          message: 'Refresh token reuse detected',
        });
      }

      const nextPayload = this.buildTokenPayload({
        familyId: currentToken.familyId,
        parentTokenId: currentToken.id,
        userId: currentToken.userId,
        workspaceId: currentToken.workspaceId,
      });

      await repository.save(
        repository.create({
          expiresAt: nextPayload.expiresAt,
          familyId: nextPayload.familyId,
          id: nextPayload.tokenId,
          lastUsedAt: null,
          parentTokenId: currentToken.id,
          replacedByTokenId: null,
          revokeReason: null,
          revokedAt: null,
          tokenHash: this.hashToken(nextPayload.refreshToken),
          userId: nextPayload.userId,
          workspaceId: nextPayload.workspaceId ?? null,
        }),
      );

      currentToken.lastUsedAt = new Date();
      currentToken.replacedByTokenId = nextPayload.tokenId;
      currentToken.revokeReason = 'rotated';
      currentToken.revokedAt = new Date();
      await repository.save(currentToken);

      return nextPayload;
    });
  }

  private buildTokenPayload(
    input: IssueRefreshTokenInput,
  ): RefreshTokenPayload {
    return {
      expiresAt: input.expiresAt ?? this.calculateExpiryDate(),
      familyId: input.familyId ?? randomUUID(),
      refreshToken: this.generateRefreshToken(),
      tokenId: randomUUID(),
      userId: input.userId,
      workspaceId: input.workspaceId ?? null,
    };
  }

  private calculateExpiryDate(): Date {
    const ttlDays = this.configurationService.getRefreshTokenConfig().ttlDays;
    return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  }

  private generateRefreshToken(): string {
    const byteLength =
      this.configurationService.getRefreshTokenConfig().byteLength;

    return randomBytes(byteLength).toString('base64url');
  }

  private hashToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private isExpired(token: RefreshTokenEntity): boolean {
    return token.expiresAt.getTime() <= Date.now();
  }

  private async loadTokenByValue(
    refreshToken: string,
    repository = this.refreshTokenRepository,
  ): Promise<RefreshTokenEntity | null> {
    return repository.findOne({
      where: {
        tokenHash: this.hashToken(refreshToken),
      },
    });
  }

  private async revokeFamilyWithRepository(
    repository: Repository<RefreshTokenEntity>,
    familyId: string,
    reason: string,
  ): Promise<void> {
    const now = new Date();
    await repository
      .createQueryBuilder()
      .update(RefreshTokenEntity)
      .set({
        revokeReason: reason,
        revokedAt: now,
      })
      .where('family_id = :familyId', { familyId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }
}
