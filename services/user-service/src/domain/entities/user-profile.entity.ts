export class UserProfile {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly username: string | null,
    public readonly fullName: string,
    public readonly displayName: string | null,
    public readonly avatarUrl: string | null,
    public readonly coverUrl: string | null,
    public readonly bio: string | null,
    public readonly jobTitle: string | null,
    public readonly department: string | null,
    public readonly location: string | null,
    public readonly timezone: string | null,
    public readonly locale: string | null,
    public readonly emailVerified: boolean,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
