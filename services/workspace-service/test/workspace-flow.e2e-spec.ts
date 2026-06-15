import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CreateWorkspaceUseCase } from '../src/application/use-cases/workspace/create-workspace.use-case';
import { GetWorkspaceUseCase } from '../src/application/use-cases/workspace/get-workspace.use-case';
import { ListWorkspacesUseCase } from '../src/application/use-cases/workspace/list-workspaces.use-case';
import { UpdateWorkspaceUseCase } from '../src/application/use-cases/workspace/update-workspace.use-case';
import { DeleteWorkspaceUseCase } from '../src/application/use-cases/workspace/delete-workspace.use-case';
import { ListMembersUseCase } from '../src/application/use-cases/workspace/list-members.use-case';
import { GetWorkspaceActivityUseCase } from '../src/application/use-cases/workspace/get-workspace-activity.use-case';
import { InviteMemberUseCase } from '../src/application/use-cases/invitation/invite-member.use-case';
import { AcceptInvitationUseCase } from '../src/application/use-cases/invitation/accept-invitation.use-case';
import { ListInvitationsUseCase } from '../src/application/use-cases/invitation/list-invitations.use-case';
import { RejectInvitationUseCase } from '../src/application/use-cases/invitation/reject-invitation.use-case';
import { WORKSPACE_REPOSITORY } from '../src/domain/repositories/workspace.repository';
import { WORKSPACE_MEMBER_REPOSITORY } from '../src/domain/repositories/workspace-member.repository';
import { INVITATION_REPOSITORY } from '../src/domain/repositories/invitation.repository';
import { WORKSPACE_ACTIVITY_REPOSITORY } from '../src/domain/repositories/workspace-activity.repository';
import { WorkspaceController } from '../src/presentation/http/workspace.controller';
import { InvitationController } from '../src/presentation/http/invitation.controller';
import { AuthGuard } from '../src/presentation/http/guards/auth.guard';
import { IdempotencyService } from '../src/infrastructure/idempotency/idempotency.service';
import { createInMemoryWorkspaceRepositories } from './support/in-memory-workspace-repositories';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const INVITEE_ID = '22222222-2222-4222-8222-222222222222';

describe('Workspace invitation flow (e2e)', () => {
  let app: INestApplication<App>;
  const repos = createInMemoryWorkspaceRepositories();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WorkspaceController, InvitationController],
      providers: [
        CreateWorkspaceUseCase,
        ListMembersUseCase,
        InviteMemberUseCase,
        AcceptInvitationUseCase,
        ListInvitationsUseCase,
        RejectInvitationUseCase,
        { provide: GetWorkspaceUseCase, useValue: { execute: jest.fn() } },
        { provide: ListWorkspacesUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateWorkspaceUseCase, useValue: { execute: jest.fn() } },
        { provide: DeleteWorkspaceUseCase, useValue: { execute: jest.fn() } },
        { provide: GetWorkspaceActivityUseCase, useValue: { execute: jest.fn() } },
        { provide: WORKSPACE_REPOSITORY, useValue: repos.workspaceRepo },
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: repos.memberRepo },
        { provide: INVITATION_REPOSITORY, useValue: repos.invitationRepo },
        { provide: WORKSPACE_ACTIVITY_REPOSITORY, useValue: repos.activityRepo },
        {
          provide: IdempotencyService,
          useValue: { findCached: jest.fn(), store: jest.fn() },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string | undefined>;
              user?: { id: string };
            };
          };
        }) => {
          const request = context.switchToHttp().getRequest();
          const userId = request.headers['x-user-id'];
          if (typeof userId !== 'string' || !userId.trim()) {
            return false;
          }
          request.user = { id: userId.trim() };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('create workspace → invite → accept → list members', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('X-User-Id', OWNER_ID)
      .send({ name: 'E2E Workspace', description: 'Invitation flow test' })
      .expect(201);

    const workspaceId = createResponse.body.id as string;
    expect(workspaceId).toBeTruthy();

    const inviteResponse = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/invite`)
      .set('X-User-Id', OWNER_ID)
      .send({ email: 'invitee@collabspace.dev' })
      .expect(201);

    const invitationId = inviteResponse.body.id as string;
    expect(invitationId).toBeTruthy();

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceId}/invitations`)
      .set('X-User-Id', OWNER_ID)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(1);
        expect(response.body[0].id).toBe(invitationId);
        expect(response.body[0].status).toBe('pending');
      });

    await request(app.getHttpServer())
      .post(`/api/v1/invitations/${invitationId}/accept`)
      .set('X-User-Id', INVITEE_ID)
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('accepted');
        expect(response.body.workspaceId).toBe(workspaceId);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceId}/members`)
      .set('X-User-Id', OWNER_ID)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(2);
        const userIds = response.body.map((member: { userId: string }) => member.userId);
        expect(userIds).toEqual(expect.arrayContaining([OWNER_ID, INVITEE_ID]));
      });
  });
});
