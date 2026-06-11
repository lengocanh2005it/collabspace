export class UserProfile {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly username: string | null,
    public readonly fullName: string,
    public readonly displayName: string | null,
    public readonly avatarUrl: string | null,
    public readonly bio: string | null,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
