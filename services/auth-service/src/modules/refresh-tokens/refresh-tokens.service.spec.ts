import { ConfigurationService } from '@/configuration/configuration.service';
import { UnauthorizedException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { RefreshTokensService } from './refresh-tokens.service';

describe('RefreshTokensService', () => {
  const configurationServiceMock = {
    getRefreshTokenConfig: jest.fn(() => ({
      byteLength: 32,
      ttlDays: 30,
    })),
  } as unknown as ConfigurationService;

  const repositoryMock = {
    create: jest.fn((value) => value),
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as Repository<RefreshTokenEntity>;

  const dataSourceMock = {
    transaction: jest.fn(),
  } as unknown as DataSource;

  let refreshTokensService: RefreshTokensService;

  beforeEach(() => {
    jest.clearAllMocks();
    (dataSourceMock.transaction as jest.Mock).mockImplementation(
      async (
        callback: (manager: {
          getRepository: () => Repository<RefreshTokenEntity>;
        }) => unknown,
      ) =>
        callback({
          getRepository: () => repositoryMock,
        }),
    );
    refreshTokensService = new RefreshTokensService(
      configurationServiceMock,
      dataSourceMock,
      repositoryMock,
    );
  });

  it('issues a refresh token with hashed persistence', async () => {
    (repositoryMock.save as jest.Mock).mockResolvedValue(undefined);

    const payload = await refreshTokensService.issue({
      userId: '0d0a930c-f3c4-4db2-98fc-6a6932651910',
      workspaceId: 'ff2344a5-f498-4a10-8f79-9b0992b87255',
    });

    expect(payload.refreshToken).toBeTruthy();
    expect(payload.familyId).toBeTruthy();
    expect(repositoryMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: payload.familyId,
        tokenHash: expect.any(String),
        userId: '0d0a930c-f3c4-4db2-98fc-6a6932651910',
        workspaceId: 'ff2344a5-f498-4a10-8f79-9b0992b87255',
      }),
    );
    expect(
      (repositoryMock.save as jest.Mock).mock.calls[0][0].tokenHash,
    ).not.toBe(payload.refreshToken);
  });

  it('rotates an active token into the same family', async () => {
    const currentToken: RefreshTokenEntity = {
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      familyId: 'fam-1',
      id: 'token-1',
      lastUsedAt: null,
      parentTokenId: null,
      replacedByTokenId: null,
      revokeReason: null,
      revokedAt: null,
      tokenHash: 'hash-1',
      updatedAt: new Date(),
      userId: 'user-1',
      workspaceId: 'workspace-1',
    };

    (repositoryMock.findOne as jest.Mock).mockResolvedValue(currentToken);
    (repositoryMock.save as jest.Mock).mockResolvedValue(undefined);

    const queryBuilderMock = {
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
      set: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };
    (repositoryMock.createQueryBuilder as jest.Mock).mockReturnValue(
      queryBuilderMock,
    );

    const payload = await refreshTokensService.rotate('plain-refresh-token');

    expect(payload.familyId).toBe('fam-1');
    expect(payload.userId).toBe('user-1');
    expect(payload.workspaceId).toBe('workspace-1');
    expect(repositoryMock.save).toHaveBeenCalledTimes(2);
    expect(currentToken.revokeReason).toBe('rotated');
    expect(currentToken.replacedByTokenId).toBe(payload.tokenId);
  });

  it('revokes the whole family when a rotated token is reused', async () => {
    const currentToken: RefreshTokenEntity = {
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      familyId: 'fam-2',
      id: 'token-2',
      lastUsedAt: null,
      parentTokenId: null,
      replacedByTokenId: 'token-3',
      revokeReason: 'rotated',
      revokedAt: new Date(),
      tokenHash: 'hash-2',
      updatedAt: new Date(),
      userId: 'user-2',
      workspaceId: null,
    };

    const queryBuilderMock = {
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
      set: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };

    (repositoryMock.findOne as jest.Mock).mockResolvedValue(currentToken);
    (repositoryMock.createQueryBuilder as jest.Mock).mockReturnValue(
      queryBuilderMock,
    );

    await expect(
      refreshTokensService.rotate('reused-refresh-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(queryBuilderMock.where).toHaveBeenCalledWith(
      'family_id = :familyId',
      {
        familyId: 'fam-2',
      },
    );
  });
});
