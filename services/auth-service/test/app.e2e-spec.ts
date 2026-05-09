import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RefreshTokensService } from '../src/modules/refresh-tokens/refresh-tokens.service';
import { IdentityService } from '../src/modules/identity/identity.service';
import { UserProfilesGrpcService } from '../src/modules/identity/user-profiles-grpc.service';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuthService } from '../src/app.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let authService: AuthService;
  const refreshTokensServiceMock = {
    issue: jest.fn(),
    revokeToken: jest.fn(),
    rotate: jest.fn(),
  };
  const identityServiceMock = {
    getAuthUserById: jest.fn(),
    validateCredentials: jest.fn(),
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
      permissions: [],
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
    });
    identityServiceMock.validateCredentials.mockResolvedValue({
      email: 'member@example.com',
      emailVerified: true,
      isActive: true,
      permissions: [],
      role: 'member',
      roles: ['member'],
      userId: 'user-123',
    });
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
    expect(response.headers['x-workspace-id']).toBe('workspace-456');
    expect(response.headers['x-request-id']).toBe('req-123');
    expect(response.body).toEqual({
      authenticated: true,
      role: 'member',
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

  afterEach(async () => {
    await app.close();
  });
});
