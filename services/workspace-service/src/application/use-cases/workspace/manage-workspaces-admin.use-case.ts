import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type IWorkspaceRepository,
  WORKSPACE_REPOSITORY,
} from '../../../domain/repositories/workspace.repository';

@Injectable()
export class ManageWorkspacesAdminUseCase {
  private readonly logger = new Logger(ManageWorkspacesAdminUseCase.name);

  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly repository: IWorkspaceRepository,
  ) {}

  list() {
    return this.repository.adminListAll();
  }

  async forceDelete(actorId: string, workspaceId: string): Promise<void> {
    await this.repository.adminForceDelete(workspaceId, actorId);
    this.logger.warn(
      `admin_action=force_delete_workspace actorId=${actorId} workspaceId=${workspaceId}`,
    );
  }

  async forceJoin(
    actorId: string,
    workspaceId: string,
    role: 'member',
    reason: string,
  ): Promise<void> {
    await this.repository.adminForceJoin(workspaceId, actorId, role);
    this.logger.warn(
      `admin_action=force_join_workspace actorId=${actorId} workspaceId=${workspaceId} role=${role} reason=${JSON.stringify(reason)}`,
    );
  }
}
