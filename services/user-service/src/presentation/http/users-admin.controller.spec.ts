import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  PLATFORM_IDENTITY_RESOLVER,
  PlatformAdminGuard,
} from '@collabspace/nest-auth';
import { ManageUsersAdminUseCase } from '../../application/use-cases/manage-users-admin.use-case';
import { UsersAdminController } from './users-admin.controller';

describe('UsersAdminController (http)', () => {
  let app: Awaited<ReturnType<typeof createApp>>['app'];
  const useCase = {
    anonymize: jest.fn(),
    list: jest.fn(),
  };
  const identityResolver = {
    resolve: jest.fn(),
  };

  async function createApp() {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersAdminController],
      providers: [
        PlatformAdminGuard,
        { provide: ManageUsersAdminUseCase, useValue: useCase },
        { provide: PLATFORM_IDENTITY_RESOLVER, useValue: identityResolver },
      ],
    }).compile();
    const nestApp = moduleRef.createNestApplication();
    nestApp.setGlobalPrefix('api/v1');
    await nestApp.init();
    return { app: nestApp, moduleRef };
  }

  beforeAll(async () => {
    ({ app } = await createApp());
  });

  beforeEach(() => jest.clearAllMocks());

  it('rejects non-admin callers', async () => {
    identityResolver.resolve.mockResolvedValue({
      role: 'member',
      roles: ['member'],
      userId: 'user-1',
    });

    await request(app.getHttpServer())
      .get('/api/v1/users/admin/all')
      .set('Authorization', 'Bearer member')
      .expect(403);
  });

  it('lists accounts for platform admins', async () => {
    identityResolver.resolve.mockResolvedValue({
      role: 'admin',
      roles: ['admin'],
      userId: 'admin-1',
    });
    useCase.list.mockResolvedValue([
      { email: 'jane@example.com', fullName: 'Jane Doe', id: 'user-1' },
    ]);

    await request(app.getHttpServer())
      .get('/api/v1/users/admin/all')
      .set('Authorization', 'Bearer admin')
      .expect(200)
      .expect([
        { email: 'jane@example.com', fullName: 'Jane Doe', id: 'user-1' },
      ]);
  });

  afterAll(async () => {
    await app?.close();
  });
});
