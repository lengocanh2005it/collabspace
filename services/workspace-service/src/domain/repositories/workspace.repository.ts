import { Workspace } from '../entities/workspace.entity';

export const WORKSPACE_REPOSITORY = Symbol('WORKSPACE_REPOSITORY');

export interface IWorkspaceRepository {
  findById(id: string): Promise<Workspace | null>;
  findByMember(userId: string): Promise<Workspace[]>;
  createWithOwner(data: {
    name: string;
    description?: string;
    ownerId: string;
    userId: string;
  }): Promise<Workspace>;
  update(
    id: string,
    data: { name?: string; description?: string },
  ): Promise<Workspace>;
}
