import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/database/database.module';
import { IdempotencyService } from './infrastructure/idempotency/idempotency.service';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { RabbitMqModule } from './infrastructure/messaging/rabbitmq.module';
import { WorkspaceController } from './presentation/http/workspace.controller';
import { HealthController } from './presentation/http/health.controller';
import { ProjectController } from './presentation/http/project.controller';
import { InvitationController } from './presentation/http/invitation.controller';
import { CreateWorkspaceUseCase } from './application/use-cases/workspace/create-workspace.use-case';
import { GetWorkspaceUseCase } from './application/use-cases/workspace/get-workspace.use-case';
import { ListWorkspacesUseCase } from './application/use-cases/workspace/list-workspaces.use-case';
import { UpdateWorkspaceUseCase } from './application/use-cases/workspace/update-workspace.use-case';
import { ListMembersUseCase } from './application/use-cases/workspace/list-members.use-case';
import { CreateProjectUseCase } from './application/use-cases/project/create-project.use-case';
import { ListProjectsUseCase } from './application/use-cases/project/list-projects.use-case';
import { UpdateProjectUseCase } from './application/use-cases/project/update-project.use-case';
import { DeleteProjectUseCase } from './application/use-cases/project/delete-project.use-case';
import { InviteMemberUseCase } from './application/use-cases/invitation/invite-member.use-case';
import { AcceptInvitationUseCase } from './application/use-cases/invitation/accept-invitation.use-case';
import { RejectInvitationUseCase } from './application/use-cases/invitation/reject-invitation.use-case';
import { CheckWorkspaceMembershipUseCase } from './application/use-cases/workspace/check-workspace-membership.use-case';
import { GetWorkspaceActivityUseCase } from './application/use-cases/workspace/get-workspace-activity.use-case';
import { WorkspaceHealthService } from './health/workspace-health.service';
import { MetricsModule } from './metrics/metrics.module';
import { AuthModule } from './integrations/auth/auth.module';
import { AuthGuard } from './presentation/http/guards/auth.guard';
import { InternalWorkspaceController } from './presentation/http/internal-workspace.controller';
import { TypeOrmWorkspaceRepository } from './infrastructure/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from './infrastructure/repositories/typeorm-workspace-member.repository';
import { TypeOrmProjectRepository } from './infrastructure/repositories/typeorm-project.repository';
import { TypeOrmInvitationRepository } from './infrastructure/repositories/typeorm-invitation.repository';
import { TypeOrmWorkspaceActivityRepository } from './infrastructure/repositories/typeorm-workspace-activity.repository';
import { WORKSPACE_REPOSITORY } from './domain/repositories/workspace.repository';
import { WORKSPACE_MEMBER_REPOSITORY } from './domain/repositories/workspace-member.repository';
import { PROJECT_REPOSITORY } from './domain/repositories/project.repository';
import { INVITATION_REPOSITORY } from './domain/repositories/invitation.repository';
import { WORKSPACE_ACTIVITY_REPOSITORY } from './domain/repositories/workspace-activity.repository';
import { ListInvitationsUseCase } from './application/use-cases/invitation/list-invitations.use-case';
import { WorkspaceAdminController } from './presentation/http/workspace-admin.controller';
import { ManageWorkspacesAdminUseCase } from './application/use-cases/workspace/manage-workspaces-admin.use-case';

@Module({
  imports: [
    DatabaseModule,
    MetricsModule,
    OutboxModule,
    RabbitMqModule,
    AuthModule,
  ],
  controllers: [
    HealthController,
    InternalWorkspaceController,
    WorkspaceController,
    WorkspaceAdminController,
    ProjectController,
    InvitationController,
  ],
  providers: [
    // Use cases
    CreateWorkspaceUseCase,
    GetWorkspaceUseCase,
    ListWorkspacesUseCase,
    UpdateWorkspaceUseCase,
    ListMembersUseCase,
    CheckWorkspaceMembershipUseCase,
    GetWorkspaceActivityUseCase,
    ManageWorkspacesAdminUseCase,
    CreateProjectUseCase,
    ListProjectsUseCase,
    UpdateProjectUseCase,
    DeleteProjectUseCase,
    InviteMemberUseCase,
    AcceptInvitationUseCase,
    RejectInvitationUseCase,
    // Infrastructure adapters
    TypeOrmWorkspaceRepository,
    TypeOrmWorkspaceMemberRepository,
    TypeOrmProjectRepository,
    TypeOrmInvitationRepository,
    TypeOrmWorkspaceActivityRepository,
    // Port bindings
    { provide: WORKSPACE_REPOSITORY, useClass: TypeOrmWorkspaceRepository },
    {
      provide: WORKSPACE_MEMBER_REPOSITORY,
      useClass: TypeOrmWorkspaceMemberRepository,
    },
    { provide: PROJECT_REPOSITORY, useClass: TypeOrmProjectRepository },
    { provide: INVITATION_REPOSITORY, useClass: TypeOrmInvitationRepository },
    {
      provide: WORKSPACE_ACTIVITY_REPOSITORY,
      useClass: TypeOrmWorkspaceActivityRepository,
    },
    // Other services
    WorkspaceHealthService,
    IdempotencyService,
    AuthGuard,
    ListInvitationsUseCase,
  ],
})
export class AppModule {}
