export class SyncUserReplicaCommand {
  constructor(
    public readonly userId: string,
    public readonly fullName: string,
    public readonly displayName?: string | null,
    public readonly avatarUrl?: string | null,
  ) {}
}