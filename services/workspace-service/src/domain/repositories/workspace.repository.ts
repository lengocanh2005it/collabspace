import type { Workspace } from '../entities/workspace.entity';

export const WORKSPACE_REPOSITORY = Symbol('WORKSPACE_REPOSITORY');

export interface IWorkspaceRepository {
  deleteByOwner(id: string, actorId: string): Promise<void>;
  adminForceDelete(id: string, actorId: string): Promise<void>;
  adminForceJoin(id: string, userId: string, role: 'admin'): Promise<void>;
  adminListAll(): Promise<Array<Workspace & { memberCount: number }>>;
  findById(id: string): Promise<Workspace | null>;
  findByMember(userId: string): Promise<Workspace[]>;
  createWithOwner(data: {
    name: string;
    description?: string;
    ownerId: string;
    userId: string;
  }): Promise<Workspace>;
  update(id: string, data: { name?: string; description?: string }): Promise<Workspace>;
}
