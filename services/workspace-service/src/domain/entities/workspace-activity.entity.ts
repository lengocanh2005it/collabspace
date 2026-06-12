export type WorkspaceActivityType =
  | 'workspace_created'
  | 'member_invited'
  | 'member_joined'
  | 'invitation_rejected'
  | 'project_created'
  | 'project_updated'
  | 'project_deleted';

export class WorkspaceActivity {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly actorId: string | null,
    public readonly actorName: string | null,
    public readonly type: WorkspaceActivityType,
    public readonly summary: string,
    public readonly meta: Record<string, unknown>,
    public readonly occurredAt: Date,
  ) {}
}
