import { Inject, Injectable } from '@nestjs/common';
import { CreateWorkspaceDto } from '../../dto/create-workspace.dto';
import {
  type IWorkspaceRepository,
  WORKSPACE_REPOSITORY,
} from '../../../domain/repositories/workspace.repository';

@Injectable()
export class CreateWorkspaceUseCase {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepo: IWorkspaceRepository,
  ) {}

  async execute(userId: string, dto: CreateWorkspaceDto) {
    return this.workspaceRepo.createWithOwner({
      name: dto.name,
      description: dto.description,
      ownerId: userId,
      userId,
    });
  }
}
