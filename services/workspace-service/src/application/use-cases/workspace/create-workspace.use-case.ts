import { Inject, Injectable } from '@nestjs/common';
import { CreateWorkspaceDto } from '../../dto/create-workspace.dto';
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

    await this.activityRepo.record({
      workspaceId: workspace.id,
      actorId: userId,
      actorName: null,
      type: 'workspace_created',
      summary: `Workspace "${workspace.name}" was created`,
      meta: { workspaceName: workspace.name },
    });

    return workspace;
  }
}
