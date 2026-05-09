export class UserPreferences {
  constructor(
    public readonly userId: string,
    public readonly theme: string,
    public readonly language: string,
    public readonly timezone: string | null,
    public readonly dateFormat: string,
    public readonly timeFormat: string,
    public readonly weekStartsOn: string,
    public readonly emailNotificationsEnabled: boolean,
    public readonly pushNotificationsEnabled: boolean,
    public readonly desktopNotificationsEnabled: boolean,
    public readonly digestFrequency: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
