import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailsService } from '../src/modules/emails/emails.service';
import { RefreshTokensService } from '../src/modules/refresh-tokens/refresh-tokens.service';
import { IdentityService } from '../src/modules/identity/identity.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { UserProfilesGrpcService } from '../src/modules/identity/user-profiles-grpc.service';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuthService } from '../src/app.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let authService: AuthService;
  const refreshTokensServiceMock = {
    issue: jest.fn(),
    listSessionsByUserId: jest.fn(),
    revokeAllForUser: jest.fn(),
    revokeFamilyForUser: jest.fn(),
    revokeOtherFamiliesForUser: jest.fn(),
    revokeToken: jest.fn(),
    rotate: jest.fn(),
  };
  const identityServiceMock = {
    changePassword: jest.fn(),
    findUserByEmailForPasswordReset: jest.fn(),
    getAuthUserById: jest.fn(),
    resetPassword: jest.fn(),
    validateCredentials: jest.fn(),
  };
  const redisServiceMock = {
    delete: jest.fn(),
    getJson: jest.fn(),
    setJson: jest.fn(),
  };
  const emailsServiceMock = {
    sendText: jest.fn(),
  };
  const userProfilesGrpcServiceMock = {
    getProfile: jest.fn(),
  };
  const jwtSecret = 'test-secret';

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = jwtSecret;
    process.env.JWT_EXPIRY = '10m';
    identityServiceMock.getAuthUserById.mockResolvedValue({
      email: 'member@example.com',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
    });
    identityServiceMock.validateCredentials.mockResolvedValue({
      email: 'member@example.com',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
    });
    identityServiceMock.findUserByEmailForPasswordReset.mockResolvedValue({
      email: 'member@example.com',
      isActive: true,
      userId: 'user-123',
    });
    identityServiceMock.resetPassword.mockResolvedValue(undefined);
    identityServiceMock.changePassword.mockResolvedValue(undefined);
    redisServiceMock.setJson.mockResolvedValue('OK');
    redisServiceMock.getJson.mockResolvedValue({
      email: 'member@example.com',
      userId: 'user-123',
    });
    redisServiceMock.delete.mockResolvedValue(1);
    emailsServiceMock.sendText.mockResolvedValue({});
    userProfilesGrpcServiceMock.getProfile.mockResolvedValue({
      fullName: 'Member Example',
      userId: 'user-123',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RefreshTokensService)
      .useValue(refreshTokensServiceMock)
      .overrideProvider(IdentityService)
      .useValue(identityServiceMock)
      .overrideProvider(RedisService)
      .useValue(redisServiceMock)
      .overrideProvider(EmailsService)
      .useValue(emailsServiceMock)
      .overrideProvider(UserProfilesGrpcService)
      .useValue(userProfilesGrpcServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    authService = moduleFixture.get(AuthService);
    await app.init();
  });

  it('/api/v1/auth/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/auth/health')
      .expect(200)
      .expect({
        service: 'auth-service',
        status: 'ok',
      });
  });

  it('/api/v1/auth/verify (GET) returns identity headers for valid JWT', async () => {
    const token = await authService.signAccessToken({
      role: 'member',
      workspaceId: 'workspace-456',
      userId: 'user-123',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/verify')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Request-Id', 'req-123')
      .expect(200);

    expect(response.headers['x-user-id']).toBe('user-123');
    expect(response.headers['x-user-name']).toBe('Member Example');
    expect(response.headers['x-role']).toBe('member');
    expect(response.headers['x-roles']).toBe('member');
    expect(response.headers['x-permissions']).toBe('users.read');
    expect(response.headers['x-email-verified']).toBe('true');
    expect(response.headers['x-workspace-id']).toBe('workspace-456');
    expect(response.headers['x-request-id']).toBe('req-123');
    expect(response.body).toEqual({
      authenticated: true,
      emailVerified: true,
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      workspaceId: 'workspace-456',
      userId: 'user-123',
    });
  });

  it('/api/v1/auth/verify (GET) rejects invalid JWT', () => {
    return request(app.getHttpServer())
      .get('/api/v1/auth/verify')
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);
  });

  it('/api/v1/auth/login (POST) returns an access token and refresh token', async () => {
    refreshTokensServiceMock.issue.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      familyId: 'family-1',
      refreshToken: 'refresh-token-login',
      tokenId: 'token-1',
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'member@example.com',
        password: 'password123',
        workspaceId: 'workspace-456',
      })
      .expect(200);

    expect(response.body.refreshToken).toBe('refresh-token-login');
    expect(response.body.userId).toBe('user-123');
    expect(response.body.role).toBe('member');
    expect(response.body.accessToken).toBeTruthy();
  });

  it('/api/v1/auth/forgot-password (POST) accepts request and queues reset email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({
        email: 'member@example.com',
      })
      .expect(200)
      .expect({
        accepted: true,
      });

    expect(identityServiceMock.findUserByEmailForPasswordReset).toHaveBeenCalledWith(
      'member@example.com',
    );
    expect(redisServiceMock.setJson).toHaveBeenCalled();
    expect(emailsServiceMock.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Reset your CollabSpace password',
        to: 'member@example.com',
      }),
    );
  });

  it('/api/v1/auth/reset-password (POST) resets password and revokes sessions', async () => {
    refreshTokensServiceMock.revokeAllForUser.mockResolvedValue(3);

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        newPassword: 'new-password-123',
        token: 'reset-token-1',
      })
      .expect(200)
      .expect({
        reset: true,
        revokedSessionCount: 3,
        userId: 'user-123',
      });

    expect(identityServiceMock.resetPassword).toHaveBeenCalledWith(
      'user-123',
      'new-password-123',
    );
    expect(redisServiceMock.delete).toHaveBeenCalled();
  });

  it('/api/v1/auth/change-password (POST) changes password for authenticated user', async () => {
    refreshTokensServiceMock.revokeAllForUser.mockResolvedValue(2);
    const token = await authService.signAccessToken({
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'password123',
        newPassword: 'password456',
      })
      .expect(200)
      .expect({
        changed: true,
        revokedSessionCount: 2,
        userId: 'user-123',
      });

    expect(identityServiceMock.changePassword).toHaveBeenCalledWith(
      'user-123',
      'password123',
      'password456',
    );
  });

  it('/api/v1/auth/refresh (POST) rotates refresh token', async () => {
    identityServiceMock.getAuthUserById.mockResolvedValue({
      email: 'member@example.com',
      emailVerified: true,
      isActive: true,
      permissions: [],
      role: 'member',
      roles: ['member'],
      userId: 'user-321',
    });

    refreshTokensServiceMock.rotate.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      familyId: 'family-2',
      refreshToken: 'refresh-token-next',
      tokenId: 'token-2',
      userId: 'user-321',
      workspaceId: 'workspace-654',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: 'refresh-token-current',
      })
      .expect(200);

    expect(response.body.refreshToken).toBe('refresh-token-next');
    expect(response.body.userId).toBe('user-321');
    expect(response.body.accessToken).toBeTruthy();
  });

  it('/api/v1/auth/logout (POST) revokes the refresh token', async () => {
    refreshTokensServiceMock.revokeToken.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({
        refreshToken: 'refresh-token-current',
      })
      .expect(200)
      .expect({
        revoked: true,
      });
  });

  it('/api/v1/auth/sessions (GET) returns current user sessions', async () => {
    refreshTokensServiceMock.listSessionsByUserId.mockResolvedValue([
      {
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        expiresAt: new Date('2099-05-30T00:00:00.000Z'),
        familyId: 'family-1',
        id: 'token-1',
        lastUsedAt: new Date('2026-05-02T00:00:00.000Z'),
        parentTokenId: null,
        replacedByTokenId: null,
        revokeReason: null,
        revokedAt: null,
        tokenHash: 'hash',
        updatedAt: new Date('2026-05-02T00:00:00.000Z'),
        userId: 'user-123',
        workspaceId: 'workspace-456',
      },
    ]);
    const token = await authService.signAccessToken({
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        familyId: 'family-1',
        isActive: true,
        tokenId: 'token-1',
        userId: 'user-123',
        workspaceId: 'workspace-456',
      }),
    ]);
  });

  it('/api/v1/auth/logout-all (POST) revokes all sessions for the user', async () => {
    refreshTokensServiceMock.revokeAllForUser.mockResolvedValue(4);
    const token = await authService.signAccessToken({
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({
        revokedCount: 4,
      });
  });

  it('/api/v1/auth/logout-others (POST) revokes other sessions', async () => {
    refreshTokensServiceMock.revokeOtherFamiliesForUser.mockResolvedValue(2);
    const token = await authService.signAccessToken({
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout-others')
      .set('Authorization', `Bearer ${token}`)
      .send({
        refreshToken: 'refresh-token-current',
      })
      .expect(200)
      .expect({
        revokedCount: 2,
      });
  });

  it('/api/v1/auth/sessions/:familyId (DELETE) revokes one session family', async () => {
    refreshTokensServiceMock.revokeFamilyForUser.mockResolvedValue(1);
    const token = await authService.signAccessToken({
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });

    await request(app.getHttpServer())
      .delete('/api/v1/auth/sessions/family-1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({
        revokedCount: 1,
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
