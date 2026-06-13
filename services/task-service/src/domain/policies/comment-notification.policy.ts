/**
 * Policy: who should receive comment-related notifications.
 */
export class CommentNotificationPolicy {
  static shouldNotifyAssignee(
    assigneeId: string | null | undefined,
    authorId: string,
  ): boolean {
    return !!assigneeId && assigneeId !== authorId;
  }

  static mentionRecipients(
    mentionedUserIds: string[],
    assigneeId: string | null | undefined,
  ): string[] {
    return mentionedUserIds.filter((id) => id !== assigneeId);
  }
}
