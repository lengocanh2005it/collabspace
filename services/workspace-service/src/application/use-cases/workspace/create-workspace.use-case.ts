import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CreateWorkspaceDto } from '../../dto/create-workspace.dto';
import {
  type IWorkspaceRepository,
  WORKSPACE_REPOSITORY,
} from '../../../domain/repositories/workspace.repository';
import {
  type IWorkspaceActivityRepository,
  WORKSPACE_ACTIVITY_REPOSITORY,
} from '../../../domain/repositories/workspace-activity.repository';

@Injectable()
export class CreateWorkspaceUseCase {
  private readonly logger = new Logger(CreateWorkspaceUseCase.name);

  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepo: IWorkspaceRepository,
    @Inject(WORKSPACE_ACTIVITY_REPOSITORY)
    private readonly activityRepo: IWorkspaceActivityRepository,
  ) {}

  async execute(userId: string, dto: CreateWorkspaceDto) {
    const workspace = await this.workspaceRepo.createWithOwner({
      name: dto.name,
      description: dto.description,
      ownerId: userId,
      userId,
    });

    try {
      await this.activityRepo.record({
        workspaceId: workspace.id,
        actorId: userId,
        actorName: null,
        type: 'workspace_created',
        summary: `Workspace "${workspace.name}" was created`,
        meta: { workspaceName: workspace.name },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record activity for workspace ${workspace.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return workspace;
  }
}
