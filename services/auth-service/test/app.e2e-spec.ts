import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuthService } from '../src/app.service';
import { AuthHealthService } from '../src/health/auth-health.service';
import { IdentityService } from '../src/modules/identity/identity.service';
import { UserProfilesGrpcService } from '../src/modules/identity/user-profiles-grpc.service';
import { AuthOutboxService } from '../src/modules/outbox/auth-outbox.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { RefreshTokensService } from '../src/modules/refresh-tokens/refresh-tokens.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let authService: AuthService;

  const refreshTokensServiceMock = {
    issue: jest.fn(),
    revokeAllForUser: jest.fn(),
    revokeToken: jest.fn(),
    rotate: jest.fn(),
  };
  const identityServiceMock = {
    changePassword: jest.fn(),
    findUserByEmail: jest.fn(),
    getAuthUserById: jest.fn(),
    markEmailVerified: jest.fn(),
    register: jest.fn(),
    validateCredentials: jest.fn(),
  };
  const redisServiceMock = {
    delete: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    getJson: jest.fn(),
    increment: jest.fn(),
    set: jest.fn(),
    setJson: jest.fn(),
    ttl: jest.fn(),
  };
  const authOutboxServiceMock = {
    enqueueEmailVerificationOtp: jest.fn(),
  };
  const userProfilesGrpcServiceMock = {
    createPendingProfile: jest.fn(),
    getProfile: jest.fn(),
  };
  const authHealthServiceMock = {
    getLiveness: jest.fn(),
    getReadiness: jest.fn(),
  };
  const jwtSecret = 'test-secret';

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = jwtSecret;
    process.env.JWT_EXPIRY = '10m';
    process.env.OUTBOX_ENABLED = 'false';

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
    identityServiceMock.findUserByEmail.mockResolvedValue({
      email: 'member@example.com',
      emailVerified: false,
      isActive: true,
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
    });
    identityServiceMock.register.mockResolvedValue({
      email: 'member@example.com',
      emailVerified: false,
      isActive: true,
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
    });
    identityServiceMock.markEmailVerified.mockResolvedValue({
      email: 'member@example.com',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
    });
    identityServiceMock.changePassword.mockResolvedValue(undefined);

    refreshTokensServiceMock.issue.mockResolvedValue({
      refreshToken: 'refresh-token-login',
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });
    refreshTokensServiceMock.rotate.mockResolvedValue({
      refreshToken: 'refresh-token-next',
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });
    refreshTokensServiceMock.revokeAllForUser.mockResolvedValue(2);
    refreshTokensServiceMock.revokeToken.mockResolvedValue(undefined);

    redisServiceMock.setJson.mockResolvedValue('OK');
    redisServiceMock.set.mockResolvedValue('OK');
    redisServiceMock.getJson.mockResolvedValue({
      email: 'member@example.com',
      otpHash:
        '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    });
    redisServiceMock.delete.mockResolvedValue(1);
    redisServiceMock.exists.mockResolvedValue(false);
    redisServiceMock.increment.mockResolvedValue(1);
    redisServiceMock.expire.mockResolvedValue(true);

    userProfilesGrpcServiceMock.getProfile.mockResolvedValue({
      fullName: 'Member Example',
      userId: 'user-123',
      username: 'member.example',
    });
    userProfilesGrpcServiceMock.createPendingProfile.mockResolvedValue(
      undefined,
    );
    authOutboxServiceMock.enqueueEmailVerificationOtp.mockResolvedValue(
      undefined,
    );

    authHealthServiceMock.getLiveness.mockReturnValue({
      service: 'auth-service',
      status: 'ok',
      timestamp: '2026-05-11T00:00:00.000Z',
      uptimeSeconds: 42,
    });
    authHealthServiceMock.getReadiness.mockResolvedValue({
      checks: {
        database: {
          required: true,
          responseTimeMs: 3,
          status: 'up',
        },
        redis: {
          required: true,
          responseTimeMs: 2,
          status: 'up',
        },
      },
      mode: 'full',
      ready: true,
      service: 'auth-service',
      status: 'ok',
      timestamp: '2026-05-11T00:00:00.000Z',
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
      .overrideProvider(AuthOutboxService)
      .useValue(authOutboxServiceMock)
      .overrideProvider(AuthHealthService)
      .useValue(authHealthServiceMock)
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
      .expect((response) => {
        expect(response.body.ready).toBe(true);
        expect(response.body.status).toBe('ok');
      });
  });

  it('/api/v1/auth/health/live (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/auth/health/live')
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('ok');
        expect(response.body.uptimeSeconds).toBe(42);
      });
  });

  it('/api/v1/auth/health/ready (GET) returns 503 when required dependency is down', async () => {
    authHealthServiceMock.getReadiness.mockResolvedValueOnce({
      checks: {
        database: {
          detail: 'connection refused',
          required: true,
          responseTimeMs: 5,
          status: 'down',
        },
      },
      mode: 'degraded',
      ready: false,
      service: 'auth-service',
      status: 'error',
      timestamp: '2026-05-11T00:00:00.000Z',
    });

    await request(app.getHttpServer())
      .get('/api/v1/auth/health/ready')
      .expect(503);
  });

  it('/api/v1/auth/verify (GET) returns identity headers for valid JWT', async () => {
    const token = await authService.signAccessToken({
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/verify')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Request-Id', 'req-123')
      .expect(200);

    expect(response.headers['x-user-id']).toBe('user-123');
    expect(response.headers['x-user-name']).toBe('Member Example');
    expect(response.headers['x-username']).toBe('member.example');
    expect(response.headers['x-role']).toBe('member');
    expect(response.headers['x-roles']).toBe('member');
    expect(response.headers['x-permissions']).toBe('users.read');
    expect(response.headers['x-email-verified']).toBe('true');
    expect(response.headers['x-workspace-id']).toBe('workspace-456');
    expect(response.body).toEqual({
      authenticated: true,
      emailVerified: true,
      fullName: 'Member Example',
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      username: 'member.example',
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });
  });

  it('/api/v1/auth/me (GET) returns current user', async () => {
    const token = await authService.signAccessToken({
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      email: 'member@example.com',
      emailVerified: true,
      fullName: 'Member Example',
      isActive: true,
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
      username: 'member.example',
      workspaceId: 'workspace-456',
    });
  });

  it('/api/v1/auth/login (POST) returns an access token and refresh token', async () => {
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
    expect(response.body.accessToken).toBeTruthy();
  });

  it('/api/v1/auth/register (POST) creates a pending account flow', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'member@example.com',
        fullName: 'Member Example',
        password: 'password123',
      })
      .expect(201);

    expect(response.body.verificationRequired).toBe(true);
    expect(userProfilesGrpcServiceMock.createPendingProfile).toHaveBeenCalledWith({
      fullName: 'Member Example',
      userId: 'user-123',
    });
  });

  it('/api/v1/auth/verify-email (POST) verifies the email otp', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({
        otp: '123456',
        userId: 'user-123',
      })
      .expect(200)
      .expect({
        email: 'member@example.com',
        emailVerified: true,
        verified: true,
      });
  });

  it('/api/v1/auth/change-password (POST) changes password for authenticated user', async () => {
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
  });

  it('/api/v1/auth/refresh (POST) rotates refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: 'refresh-token-current',
      })
      .expect(200);

    expect(response.body.refreshToken).toBe('refresh-token-next');
    expect(response.body.userId).toBe('user-123');
  });

  it('/api/v1/auth/logout (POST) revokes the refresh token', async () => {
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

  afterEach(async () => {
    await app?.close();
  });
});
