export class WorkspaceMember {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly userId: string,
    public readonly role: string,
    public readonly joinedAt: Date,
  ) {}
}
