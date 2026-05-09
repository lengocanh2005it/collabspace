export class UserStatus {
  constructor(
    public readonly userId: string,
    public readonly status: string,
    public readonly statusText: string | null,
    public readonly emoji: string | null,
    public readonly clearAt: Date | null,
    public readonly lastSeenAt: Date | null,
    public readonly updatedAt: Date,
  ) {}
}
