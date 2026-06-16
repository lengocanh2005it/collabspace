import type { WorkspaceRole } from '@collabspace/shared';

export class WorkspaceMember {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly userId: string,
    public readonly role: WorkspaceRole,
    public readonly joinedAt: Date,
  ) {}
}
