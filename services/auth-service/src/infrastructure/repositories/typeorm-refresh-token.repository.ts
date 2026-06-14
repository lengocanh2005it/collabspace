import {
  IssueRefreshTokenInput,
  RefreshTokenPayload,
} from '@/domain/types/refresh-token';
import { ConfigurationService } from '@/configuration/configuration.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { RefreshTokenRepository } from '@/domain/repositories/refresh-token.repository';
import type { RefreshTokenSessionSummary } from '@/domain/types/refresh-token-session';
import { RefreshTokenOrmEntity } from '@/infrastructure/database/entities/refresh-token.orm-entity';

@Injectable()
export class TypeOrmRefreshTokenRepository implements RefreshTokenRepository {
  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly dataSource: DataSource,
    @InjectRepository(RefreshTokenOrmEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenOrmEntity>,
  ) {}

  async findActiveToken(
    refreshToken: string,
  ): Promise<RefreshTokenOrmEntity | null> {
    const tokenHash = this.hashToken(refreshToken);

    return this.refreshTokenRepository.findOne({
      where: {
        expiresAt: MoreThan(new Date()),
        revokedAt: IsNull(),
        tokenHash,
      },
    });
  }

  async listSessionsByUserId(
    userId: string,
  ): Promise<RefreshTokenSessionSummary[]> {
    const tokens = await this.refreshTokenRepository.find({
      order: {
        createdAt: 'DESC',
      },
      where: {
        userId,
      },
    });
    const latestByFamily = new Map<string, RefreshTokenOrmEntity>();

    for (const token of tokens) {
      if (!latestByFamily.has(token.familyId)) {
        latestByFamily.set(token.familyId, token);
      }
    }

    return [...latestByFamily.values()]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((token) => this.toSessionSummary(token));
  }

  async issue(input: IssueRefreshTokenInput): Promise<RefreshTokenPayload> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RefreshTokenOrmEntity);
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
      .update(RefreshTokenOrmEntity)
      .set({
        revokeReason: reason,
        revokedAt: now,
      })
      .where('family_id = :familyId', { familyId })
      .andWhere('revoked_at IS NULL')
      .execute();

    return result.affected ?? 0;
  }

  async revokeFamilyForUser(
    userId: string,
    familyId: string,
    reason = 'session_revoked',
  ): Promise<number> {
    const now = new Date();
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshTokenOrmEntity)
      .set({
        revokeReason: reason,
        revokedAt: now,
      })
      .where('family_id = :familyId', { familyId })
      .andWhere('user_id = :userId', { userId })
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

  async revokeAllForUser(
    userId: string,
    reason = 'logout_all',
  ): Promise<number> {
    const now = new Date();
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshTokenOrmEntity)
      .set({
        revokeReason: reason,
        revokedAt: now,
      })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();

    return result.affected ?? 0;
  }

  async revokeOtherFamiliesForUser(
    userId: string,
    refreshToken: string,
    reason = 'logout_others',
  ): Promise<number> {
    const currentToken = await this.loadTokenByValue(refreshToken);

    if (!currentToken || currentToken.userId !== userId) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Refresh token is invalid',
      });
    }

    const now = new Date();
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshTokenOrmEntity)
      .set({
        revokeReason: reason,
        revokedAt: now,
      })
      .where('user_id = :userId', { userId })
      .andWhere('family_id != :familyId', { familyId: currentToken.familyId })
      .andWhere('revoked_at IS NULL')
      .execute();

    return result.affected ?? 0;
  }

  async rotate(refreshToken: string): Promise<RefreshTokenPayload> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RefreshTokenOrmEntity);
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

  private toSessionSummary(token: RefreshTokenOrmEntity): RefreshTokenSessionSummary {
    const now = Date.now();
    const isActive =
      !token.revokedAt && token.expiresAt.getTime() > now;

    return {
      tokenId: token.id,
      familyId: token.familyId,
      userId: token.userId,
      workspaceId: token.workspaceId,
      isActive,
      lastUsedAt: token.lastUsedAt,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      revokedAt: token.revokedAt,
    };
  }

  private isExpired(token: RefreshTokenOrmEntity): boolean {
    return token.expiresAt.getTime() <= Date.now();
  }

  private async loadTokenByValue(
    refreshToken: string,
    repository = this.refreshTokenRepository,
  ): Promise<RefreshTokenOrmEntity | null> {
    return repository.findOne({
      where: {
        tokenHash: this.hashToken(refreshToken),
      },
    });
  }

  private async revokeFamilyWithRepository(
    repository: Repository<RefreshTokenOrmEntity>,
    familyId: string,
    reason: string,
  ): Promise<void> {
    const now = new Date();
    await repository
      .createQueryBuilder()
      .update(RefreshTokenOrmEntity)
      .set({
        revokeReason: reason,
        revokedAt: now,
      })
      .where('family_id = :familyId', { familyId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }
}
