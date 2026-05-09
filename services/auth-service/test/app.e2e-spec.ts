import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RefreshTokensService } from '../src/modules/refresh-tokens/refresh-tokens.service';
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
  const jwtSecret = 'test-secret';

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = jwtSecret;
    process.env.JWT_EXPIRY = '10m';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RefreshTokensService)
      .useValue(refreshTokensServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    authService = moduleFixture.get(AuthService);
    await app.init();
  });

  it('/auth/health (GET)', () => {
    return request(app.getHttpServer()).get('/auth/health').expect(200).expect({
      service: 'auth-service',
      status: 'ok',
    });
  });

  it('/auth/verify (GET) returns identity headers for valid JWT', async () => {
    const token = await authService.signAccessToken({
      role: 'member',
      workspaceId: 'workspace-456',
      userId: 'user-123',
    });

    const response = await request(app.getHttpServer())
      .get('/auth/verify')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Request-Id', 'req-123')
      .expect(200);

    expect(response.headers['x-user-id']).toBe('user-123');
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

  it('/auth/verify (GET) rejects invalid JWT', () => {
    return request(app.getHttpServer())
      .get('/auth/verify')
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);
  });

  it('/auth/login (POST) returns an access token and refresh token', async () => {
    refreshTokensServiceMock.issue.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      familyId: 'family-1',
      refreshToken: 'refresh-token-login',
      tokenId: 'token-1',
      userId: 'user-123',
      workspaceId: 'workspace-456',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        role: 'member',
        userId: 'user-123',
        workspaceId: 'workspace-456',
      })
      .expect(200);

    expect(response.body.refreshToken).toBe('refresh-token-login');
    expect(response.body.userId).toBe('user-123');
    expect(response.body.role).toBe('member');
    expect(response.body.accessToken).toBeTruthy();
  });

  it('/auth/refresh (POST) rotates refresh token', async () => {
    refreshTokensServiceMock.rotate.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      familyId: 'family-2',
      refreshToken: 'refresh-token-next',
      tokenId: 'token-2',
      userId: 'user-321',
      workspaceId: 'workspace-654',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: 'refresh-token-current',
      })
      .expect(200);

    expect(response.body.refreshToken).toBe('refresh-token-next');
    expect(response.body.userId).toBe('user-321');
    expect(response.body.accessToken).toBeTruthy();
  });

  it('/auth/logout (POST) revokes the refresh token', async () => {
    refreshTokensServiceMock.revokeToken.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/auth/logout')
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
