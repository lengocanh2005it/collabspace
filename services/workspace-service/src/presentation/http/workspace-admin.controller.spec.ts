import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PLATFORM_IDENTITY_RESOLVER, PlatformAdminGuard } from '@collabspace/nest-auth';
import { ManageWorkspacesAdminUseCase } from '../../application/use-cases/workspace/manage-workspaces-admin.use-case';
import { WorkspaceAdminController } from './workspace-admin.controller';

describe('WorkspaceAdminController (http)', () => {
  let app: Awaited<ReturnType<typeof createApp>>['app'];
  const useCase = {
    forceDelete: jest.fn(),
    forceJoin: jest.fn(),
    list: jest.fn(),
  };
  const identityResolver = {
    resolve: jest.fn(),
  };

  async function createApp() {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkspaceAdminController],
      providers: [
        PlatformAdminGuard,
        { provide: ManageWorkspacesAdminUseCase, useValue: useCase },
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
      role: 'user',
      roles: ['user'],
      userId: 'user-1',
    });

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/admin/all')
      .set('Authorization', 'Bearer member')
      .expect(403);
  });

  it('lists workspaces for platform admins', async () => {
    identityResolver.resolve.mockResolvedValue({
      role: 'admin',
      roles: ['admin'],
      userId: 'admin-1',
    });
    useCase.list.mockResolvedValue([{ id: 'workspace-1', memberCount: 2, name: 'Demo' }]);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/admin/all')
      .set('Authorization', 'Bearer admin')
      .expect(200)
      .expect([{ id: 'workspace-1', memberCount: 2, name: 'Demo' }]);
  });

  afterAll(async () => {
    await app?.close();
  });
});
