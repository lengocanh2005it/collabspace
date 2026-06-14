import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGrpcService } from '../src/integrations/auth/auth-grpc.service';
import { AuthAdminHttpClient } from '../src/integrations/auth/auth-admin-http.client';
import { AppModule } from './../src/app.module';
import { configureHttpApp } from '../src/app.setup';
import { UserHealthService } from '../src/health/user-health.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const authGrpcServiceMock = {
    ping: jest.fn(),
    verifyAccessToken: jest.fn(),
    verifyAccessTokenLite: jest.fn(),
  };
  const authAdminHttpClientMock = {
    deactivateUser: jest.fn(),
    listUsers: jest.fn(),
  };
  const userHealthServiceMock = {
    getLiveness: jest.fn(),
    getReadiness: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.DATABASE_URL;
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
    const verifyIdentity = async (authorizationHeader?: string) => {
        if (!authorizationHeader) {
          throw new UnauthorizedException();
        }

        return {
          role: 'member',
          userId: 'user-1',
          workspaceId: 'workspace-1',
        };
      };
    authGrpcServiceMock.verifyAccessToken.mockImplementation(verifyIdentity);
    authGrpcServiceMock.verifyAccessTokenLite.mockImplementation(verifyIdentity);
    authGrpcServiceMock.ping.mockResolvedValue(undefined);
    userHealthServiceMock.getLiveness.mockReturnValue({
      service: 'user-service',
      status: 'ok',
      timestamp: '2026-05-11T00:00:00.000Z',
      uptimeSeconds: 24,
    });
    userHealthServiceMock.getReadiness.mockResolvedValue({
      checks: {
        authGrpc: {
          required: true,
          responseTimeMs: 3,
          status: 'up',
        },
        database: {
          detail:
            'DATABASE_URL not configured; using in-memory repository mode',
          required: false,
          status: 'disabled',
        },
      },
      mode: 'full',
      ready: true,
      service: 'user-service',
      status: 'ok',
      timestamp: '2026-05-11T00:00:00.000Z',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthGrpcService)
      .useValue(authGrpcServiceMock)
      .overrideProvider(AuthAdminHttpClient)
      .useValue(authAdminHttpClientMock)
      .overrideProvider(UserHealthService)
      .useValue(userHealthServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    configureHttpApp(app);
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/health')
      .expect(200)
      .expect((response) => {
        expect(response.body.ready).toBe(true);
        expect(response.body.status).toBe('ok');
        expect(response.body.service).toBe('user-service');
      });
  });

  it('/health/live (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/health/live')
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('ok');
        expect(response.body.uptimeSeconds).toBe(24);
      });
  });

  it('/health/ready (GET) returns 503 when auth dependency is down', () => {
    userHealthServiceMock.getReadiness.mockResolvedValueOnce({
      checks: {
        authGrpc: {
          detail: 'connect ECONNREFUSED',
          required: true,
          responseTimeMs: 8,
          status: 'down',
        },
      },
      mode: 'degraded',
      ready: false,
      service: 'user-service',
      status: 'error',
      timestamp: '2026-05-11T00:00:00.000Z',
    });

    return request(app.getHttpServer())
      .get('/api/v1/users/health/ready')
      .expect(503)
      .expect((response) => {
        expect(response.body.ready).toBe(false);
        expect(response.body.status).toBe('error');
      });
  });

  it('/users/:id (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/user-1')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect({
        avatarUrl: 'https://cdn.example.com/avatar-1.png',
        bio: 'Product designer',
        createdAt: '2026-01-01T00:00:00.000Z',
        displayName: 'Jane',
        fullName: 'Jane Doe',
        id: 'profile-1',
        updatedAt: '2026-01-02T00:00:00.000Z',
        userId: 'user-1',
        username: 'jane.doe',
      });
  });

  it('/users/me (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response) => {
        expect(response.body.userId).toBe('user-1');
        expect(response.body.fullName).toBe('Jane Doe');
      });
  });

  it('/users (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users?q=jane')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          items: [
            {
              avatarUrl: 'https://cdn.example.com/avatar-1.png',
              displayName: 'Jane',
              fullName: 'Jane Doe',
              status: 'online',
              userId: 'user-1',
              username: 'jane.doe',
            },
          ],
          limit: 20,
          offset: 0,
          total: 1,
        });
      });
  });

  it('/users/me (GET) requires authorization', () => {
    return request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('/users (GET) rejects invalid limit', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users?limit=500')
      .set('Authorization', 'Bearer test-token')
      .expect(400);
  });

  it('/users/bulk (POST) rejects empty body', () => {
    return request(app.getHttpServer())
      .post('/api/v1/users/bulk')
      .set('Authorization', 'Bearer test-token')
      .send({
        userIds: [],
      })
      .expect(400);
  });

  it('POST /users/internal/replicas accepts internal service token', () => {
    return request(app.getHttpServer())
      .post('/api/v1/users/internal/replicas')
      .set('X-Internal-Service-Token', 'test-internal-token')
      .send({ username: 'jane.doe' })
      .expect(201)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              userId: 'user-1',
              username: 'jane.doe',
            }),
          ]),
        );
      });
  });

  it('POST /users/internal/replicas rejects missing internal token', () => {
    return request(app.getHttpServer())
      .post('/api/v1/users/internal/replicas')
      .send({ username: 'jane.doe' })
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });
});
