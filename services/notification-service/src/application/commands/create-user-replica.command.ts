export class CreateUserReplicaCommand {
  constructor(
    public readonly userId: string,
    public readonly fullName: string,
    public readonly email?: string,
    public readonly username?: string | null,
    public readonly displayName?: string | null,
    public readonly avatarUrl?: string | null,
  ) {}
}
