export class MarkNotificationArchiveCommand {
  constructor(
    public readonly notificationId: string,
    public readonly recipientId: string,
  ) {}
}
