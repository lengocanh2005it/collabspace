import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGrpcService } from '../src/integrations/auth/auth-grpc.service';
import { AppModule } from './../src/app.module';
import { configureHttpApp } from '../src/app.setup';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const authGrpcServiceMock = {
    verifyAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    authGrpcServiceMock.verifyAccessToken.mockImplementation(
      async (authorizationHeader?: string) => {
        if (!authorizationHeader) {
          throw new UnauthorizedException();
        }

        return {
          role: 'member',
          userId: 'user-1',
          workspaceId: 'workspace-1',
        };
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthGrpcService)
      .useValue(authGrpcServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    configureHttpApp(app);
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/health')
      .expect(200)
      .expect({
        service: 'user-service',
        status: 'ok',
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
        coverUrl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        department: 'Design',
        displayName: 'Jane',
        emailVerified: true,
        fullName: 'Jane Doe',
        id: 'profile-1',
        jobTitle: 'Design Lead',
        locale: 'vi-VN',
        location: 'Ho Chi Minh City',
        timezone: 'Asia/Saigon',
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

  afterEach(async () => {
    await app.close();
  });
});
