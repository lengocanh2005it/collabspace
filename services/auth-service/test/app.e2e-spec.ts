import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtTokenService } from '../src/application/services/jwt-token.service';
import { AuthHealthService } from '../src/health/auth-health.service';
import { USER_REPOSITORY } from '../src/domain/repositories/user.repository';
import { REFRESH_TOKEN_REPOSITORY } from '../src/domain/repositories/refresh-token.repository';
import { OTP_STORE } from '../src/domain/ports/otp-store.port';
import { EMAIL_OUTBOX } from '../src/domain/ports/email-outbox.port';
import { USER_PROFILE_CLIENT } from '../src/domain/ports/user-profile-client.port';
import { AUTH_ADMIN_REPOSITORY } from '../src/domain/repositories/auth-admin.repository';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtTokenService: JwtTokenService;

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
    rollbackNewRegistration: jest.fn(),
    validateCredentials: jest.fn(),
  };
  const otpStoreMock = {
    assertAvailable: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    getJson: jest.fn(),
    increment: jest.fn(),
    ping: jest.fn(),
    set: jest.fn(),
    setJson: jest.fn(),
    ttl: jest.fn(),
  };
  const emailOutboxMock = {
    enqueueEmailVerificationOtp: jest.fn(),
    getDevOtp: jest.fn(),
    getStats: jest.fn(),
  };
  const userProfileClientMock = {
    createPendingProfile: jest.fn(),
    getProfile: jest.fn(),
    ping: jest.fn(),
  };
  const authHealthServiceMock = {
    getLiveness: jest.fn(),
    getReadiness: jest.fn(),
  };
  const authAdminRepositoryMock = {
    createRole: jest.fn(),
  };
  const jwtSecret = 'test-secret';

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = jwtSecret;
    process.env.JWT_EXPIRY = '10m';
    process.env.OUTBOX_ENABLED = 'false';

    identityServiceMock.getAuthUserById.mockImplementation(async (userId) =>
      userId === 'admin-123'
        ? {
            email: 'admin@example.com',
            emailVerified: true,
            isActive: true,
            permissions: ['auth.manage'],
            role: 'admin',
            roles: ['admin'],
            userId,
          }
        : {
            email: 'member@example.com',
            emailVerified: true,
            isActive: true,
            permissions: ['users.read'],
            role: 'member',
            roles: ['member'],
            userId: 'user-123',
          },
    );
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

    otpStoreMock.setJson.mockResolvedValue('OK');
    otpStoreMock.set.mockResolvedValue('OK');
    otpStoreMock.getJson.mockResolvedValue({
      email: 'member@example.com',
      otpHash:
        '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    });
    otpStoreMock.delete.mockResolvedValue(1);
    otpStoreMock.exists.mockResolvedValue(false);
    otpStoreMock.increment.mockResolvedValue(1);
    otpStoreMock.expire.mockResolvedValue(true);
    otpStoreMock.assertAvailable.mockResolvedValue(undefined);

    userProfileClientMock.getProfile.mockResolvedValue({
      fullName: 'Member Example',
      userId: 'user-123',
      username: 'member.example',
    });
    userProfileClientMock.createPendingProfile.mockResolvedValue(
      undefined,
    );
    emailOutboxMock.enqueueEmailVerificationOtp.mockResolvedValue(
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
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue(refreshTokensServiceMock)
      .overrideProvider(USER_REPOSITORY)
      .useValue(identityServiceMock)
      .overrideProvider(OTP_STORE)
      .useValue(otpStoreMock)
      .overrideProvider(EMAIL_OUTBOX)
      .useValue(emailOutboxMock)
      .overrideProvider(AuthHealthService)
      .useValue(authHealthServiceMock)
      .overrideProvider(USER_PROFILE_CLIENT)
      .useValue(userProfileClientMock)
      .overrideProvider(AUTH_ADMIN_REPOSITORY)
      .useValue(authAdminRepositoryMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    jwtTokenService = moduleFixture.get(JwtTokenService);
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
    const token = await jwtTokenService.signAccessToken({
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
      profileStatus: 'available',
      role: 'member',
      roles: ['member'],
      username: 'member.example',
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });
  });

  it('/api/v1/auth/me (GET) returns current user', async () => {
    const token = await jwtTokenService.signAccessToken({
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
      profileStatus: 'available',
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
      username: 'member.example',
      workspaceId: 'workspace-456',
    });
  });

  it('/api/v1/auth/admin/roles rejects a member', async () => {
    const token = await jwtTokenService.signAccessToken({
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/admin/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Support operator', name: 'support' })
      .expect(403);
  });

  it('/api/v1/auth/admin/roles allows a platform admin', async () => {
    authAdminRepositoryMock.createRole.mockResolvedValue({
      description: 'Support operator',
      id: 'role-1',
      name: 'support',
      permissions: [],
    });
    const token = await jwtTokenService.signAccessToken({
      permissions: ['auth.manage'],
      role: 'admin',
      roles: ['admin'],
      userId: 'admin-123',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/admin/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Support operator', name: 'support' })
      .expect(201)
      .expect({
        description: 'Support operator',
        id: 'role-1',
        name: 'support',
        permissions: [],
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
    expect(userProfileClientMock.createPendingProfile).toHaveBeenCalledWith({
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
    const token = await jwtTokenService.signAccessToken({
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

  it('register → login → me flow (e2e)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'flow@example.com',
        fullName: 'Flow User',
        password: 'password123',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.verificationRequired).toBe(true);
      });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'flow@example.com',
        password: 'password123',
        workspaceId: 'workspace-456',
      })
      .expect(200);

    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(200);

    expect(meResponse.body).toMatchObject({
      email: 'member@example.com',
      userId: 'user-123',
      fullName: 'Member Example',
    });
  });

  afterEach(async () => {
    await app?.close();
  });
});
