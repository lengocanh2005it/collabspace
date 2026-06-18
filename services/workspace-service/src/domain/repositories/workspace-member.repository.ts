import type { WorkspaceMember } from '../entities/workspace-member.entity';
import type { WorkspaceRole } from '@collabspace/shared';

export const WORKSPACE_MEMBER_REPOSITORY = Symbol('WORKSPACE_MEMBER_REPOSITORY');

export interface IWorkspaceMemberRepository {
  countByWorkspaceAndRole(workspaceId: string, role: string): Promise<number>;
  countMembershipsByUser(): Promise<Record<string, number>>;
  findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  findByWorkspace(workspaceId: string): Promise<WorkspaceMember[]>;
  removeByWorkspaceAndUser(workspaceId: string, userId: string): Promise<void>;
  updateRoleByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<void>;
}
