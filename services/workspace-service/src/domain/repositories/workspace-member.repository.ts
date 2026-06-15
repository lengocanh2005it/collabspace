import type { WorkspaceMember } from '../entities/workspace-member.entity';

export const WORKSPACE_MEMBER_REPOSITORY = Symbol('WORKSPACE_MEMBER_REPOSITORY');

export interface IWorkspaceMemberRepository {
  findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  findByWorkspace(workspaceId: string): Promise<WorkspaceMember[]>;
}
