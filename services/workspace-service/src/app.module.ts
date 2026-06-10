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
import { WorkspaceHealthService } from './health/workspace-health.service';
import { MetricsModule } from './metrics/metrics.module';
import { AuthModule } from './integrations/auth/auth.module';
import { AuthGuard } from './presentation/http/guards/auth.guard';
import { InternalWorkspaceController } from './presentation/http/internal-workspace.controller';

@Module({
  imports: [DatabaseModule, MetricsModule, OutboxModule, RabbitMqModule, AuthModule],
  controllers: [
    HealthController,
    InternalWorkspaceController,
    WorkspaceController,
    ProjectController,
    InvitationController,
  ],
  providers: [
    CreateWorkspaceUseCase,
    GetWorkspaceUseCase,
    ListWorkspacesUseCase,
    UpdateWorkspaceUseCase,
    ListMembersUseCase,
    CheckWorkspaceMembershipUseCase,
    CreateProjectUseCase,
    ListProjectsUseCase,
    UpdateProjectUseCase,
    DeleteProjectUseCase,
    InviteMemberUseCase,
    AcceptInvitationUseCase,
    RejectInvitationUseCase,
    WorkspaceHealthService,
    IdempotencyService,
    AuthGuard,
  ],
})
export class AppModule {}
