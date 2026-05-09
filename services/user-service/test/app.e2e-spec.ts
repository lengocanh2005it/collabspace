import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        service: 'user-service',
        status: 'ok',
      });
  });

  it('/users/:id (GET)', () => {
    return request(app.getHttpServer()).get('/users/user-1').expect(200).expect({
      avatarUrl: 'https://cdn.example.com/avatar-1.png',
      bio: 'Product designer',
      createdAt: '2026-01-01T00:00:00.000Z',
      emailVerified: true,
      fullName: 'Jane Doe',
      id: 'profile-1',
      updatedAt: '2026-01-02T00:00:00.000Z',
      userId: 'user-1',
    });
  });

  it('/internal/users/profiles (POST)', () => {
    return request(app.getHttpServer())
      .post('/internal/users/profiles')
      .send({
        fullName: 'Pending User',
        userId: 'pending-user-1',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.userId).toBe('pending-user-1');
        expect(response.body.fullName).toBe('Pending User');
        expect(response.body.emailVerified).toBe(false);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
