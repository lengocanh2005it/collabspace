import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { CommentNotificationPolicy } from "../../domain/policies/comment-notification.policy";
import { CommentPreview } from "../../domain/value-objects/CommentPreview";
import { TaskOutboxService } from "../../infrastructure/outbox/task-outbox.service";

export type PublishCommentNotificationsInput = {
  taskId: string;
  taskTitle: string;
  assigneeId: string | null | undefined;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  commentId: string;
  content: string;
  mentionedUserIds: string[];
};

/**
 * Facade over task outbox: builds and enqueues comment notification events.
 */
@Injectable()
export class TaskCommentNotificationPublisher {
  constructor(private readonly taskOutboxService: TaskOutboxService) {}

  async publishForNewComment(input: PublishCommentNotificationsInput): Promise<void> {
    const commentPreview = CommentPreview.fromContent(input.content);
    const now = new Date().toISOString();

    const assigneeId = input.assigneeId;
    if (assigneeId && CommentNotificationPolicy.shouldNotifyAssignee(assigneeId, input.authorId)) {
      await this.taskOutboxService.enqueueTaskCommented({
        eventId: randomUUID(),
        occurredAt: now,
        taskId: input.taskId,
        taskTitle: input.taskTitle,
        recipientId: assigneeId,
        actorId: input.authorId,
        actorName: input.authorName,
        actorAvatarUrl: input.authorAvatarUrl,
        commentId: input.commentId,
        commentPreview: commentPreview.toString(),
        createdAt: now,
      });
    }

    const mentionRecipients = CommentNotificationPolicy.mentionRecipients(
      input.mentionedUserIds,
      input.assigneeId,
    );

    if (mentionRecipients.length > 0) {
      await this.taskOutboxService.enqueueCommentMentionedBatch(
        mentionRecipients.map((recipientId) => ({
          eventId: randomUUID(),
          occurredAt: now,
          taskId: input.taskId,
          taskTitle: input.taskTitle,
          recipientId,
          actorId: input.authorId,
          actorName: input.authorName,
          actorAvatarUrl: input.authorAvatarUrl,
          commentId: input.commentId,
          commentPreview: commentPreview.toString(),
          createdAt: now,
        })),
      );
    }
  }
}
