import { Inject, Injectable } from '@nestjs/common';
import {
  type IWorkspaceRepository,
  WORKSPACE_REPOSITORY,
} from '../../../domain/repositories/workspace.repository';

@Injectable()
export class ListWorkspacesUseCase {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepo: IWorkspaceRepository,
  ) {}

  async execute(userId: string) {
    return this.workspaceRepo.findByMember(userId);
  }
}
