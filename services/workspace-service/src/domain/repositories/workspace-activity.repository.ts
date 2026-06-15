import type {
  WorkspaceActivity,
  WorkspaceActivityType,
} from '../entities/workspace-activity.entity';

export const WORKSPACE_ACTIVITY_REPOSITORY = Symbol('WORKSPACE_ACTIVITY_REPOSITORY');

export interface IWorkspaceActivityRepository {
  record(data: {
    workspaceId: string;
    actorId: string | null;
    actorName: string | null;
    type: WorkspaceActivityType;
    summary: string;
    meta?: Record<string, unknown>;
  }): Promise<void>;

  findByWorkspace(
    workspaceId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ items: WorkspaceActivity[]; total: number }>;
}
