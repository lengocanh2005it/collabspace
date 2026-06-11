export class Invitation {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly inviterId: string,
    public readonly inviteeEmail: string,
    public readonly inviteeUserId: string | null,
    public readonly status: string,
    public readonly createdAt: Date,
    public readonly expiresAt: Date,
  ) {}
}
