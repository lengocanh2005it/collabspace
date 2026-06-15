import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateWorkspaceDto } from '../../dto/update-workspace.dto';
import {
  type IWorkspaceRepository,
  WORKSPACE_REPOSITORY,
} from '../../../domain/repositories/workspace.repository';
import {
  type IWorkspaceMemberRepository,
  WORKSPACE_MEMBER_REPOSITORY,
} from '../../../domain/repositories/workspace-member.repository';

@Injectable()
export class UpdateWorkspaceUseCase {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepo: IWorkspaceRepository,
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
  ) {}

  async execute(userId: string, workspaceId: string, dto: UpdateWorkspaceDto) {
    const member = await this.memberRepo.findByWorkspaceAndUser(workspaceId, userId);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new ForbiddenException('Only admins or owners can update the workspace');
    }

    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return this.workspaceRepo.update(workspaceId, {
      name: dto.name,
      description: dto.description,
    });
  }
}
