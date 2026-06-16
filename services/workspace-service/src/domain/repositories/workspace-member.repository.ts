import type { WorkspaceMember } from '../entities/workspace-member.entity';

export const WORKSPACE_MEMBER_REPOSITORY = Symbol('WORKSPACE_MEMBER_REPOSITORY');

export interface IWorkspaceMemberRepository {
  countByWorkspaceAndRole(workspaceId: string, role: string): Promise<number>;
  findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  findByWorkspace(workspaceId: string): Promise<WorkspaceMember[]>;
  removeByWorkspaceAndUser(workspaceId: string, userId: string): Promise<void>;
  updateRole(workspaceId: string, userId: string, role: string): Promise<WorkspaceMember>;
}
