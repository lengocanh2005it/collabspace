import { CreateNotificationCommand } from "../usecases/create-notification/create-notification.command";
import { NotificationType } from "../../domain/value-objects/NotificationType";
import type { TaskAssignedEventPayload } from "../../domain/events/task-events";
import type {
  CommentMentionedNotificationPayload,
  TaskCommentedEventPayload,
} from "../../domain/events/comment-events";
import type { WorkspaceInvitedEventPayload } from "../../domain/events/workspace-events";

/**
 * Factory / Mapper: inbound RabbitMQ event payloads → CreateNotificationCommand.
 */
export const InboundNotificationEventMapper = {
  toTaskAssignedCommand(
    data: TaskAssignedEventPayload,
  ): CreateNotificationCommand {
    const eventId =
      data.eventId ??
      `task_assigned:${data.taskId}:${data.recipientId}:${data.assignedAt}`;

    return new CreateNotificationCommand(
      data.recipientId,
      data.actorId,
      NotificationType.TASK_ASSIGNED,
      "Giao việc mới",
      `${data.actorName} đã giao task "${data.taskTitle}" cho bạn`,
      data.taskId,
      "TASK",
      {
        actorName: data.actorName,
        actorAvatarUrl: data.actorAvatarUrl,
        taskTitle: data.taskTitle,
        assignedAt: data.assignedAt,
        workspaceId: data.workspaceId,
      },
      eventId,
    );
  },

  toTaskCommentedCommand(
    data: TaskCommentedEventPayload,
  ): CreateNotificationCommand {
    const eventId =
      data.eventId ?? `comment_created:${data.commentId}:${data.recipientId}`;

    return new CreateNotificationCommand(
      data.recipientId,
      data.actorId,
      NotificationType.TASK_COMMENT,
      "Bình luận mới trong Task",
      `${data.actorName} đã bình luận: "${data.commentPreview}"`,
      data.taskId,
      "TASK",
      {
        actorName: data.actorName,
        actorAvatarUrl: data.actorAvatarUrl,
        taskTitle: data.taskTitle,
        commentId: data.commentId,
        timestamp: data.createdAt,
      },
      eventId,
    );
  },

  toCommentMentionedCommand(
    data: CommentMentionedNotificationPayload,
  ): CreateNotificationCommand {
    const eventId =
      data.eventId ??
      `comment_mentioned:${data.commentId}:${data.recipientId}`;

    return new CreateNotificationCommand(
      data.recipientId,
      data.actorId,
      NotificationType.COMMENT_MENTIONED,
      "Bạn được nhắc trong bình luận",
      `${data.actorName} đã nhắc bạn: "${data.commentPreview}"`,
      data.taskId,
      "TASK",
      {
        actorName: data.actorName,
        actorAvatarUrl: data.actorAvatarUrl,
        taskTitle: data.taskTitle,
        commentId: data.commentId,
        timestamp: data.createdAt,
      },
      eventId,
    );
  },

  toWorkspaceInvitedCommand(
    data: WorkspaceInvitedEventPayload,
  ): CreateNotificationCommand {
    const eventId =
      data.eventId ??
      `workspace_invited:${data.workspaceId}:${data.invitedUserId}:${data.inviteEmail ?? "unknown"}`;

    return new CreateNotificationCommand(
      data.invitedUserId,
      data.invitedById,
      NotificationType.WORKSPACE_INVITED,
      "Lời mời vào workspace",
      `${data.invitedByName} đã mời bạn vào workspace "${data.workspaceName}"`,
      data.workspaceId,
      "WORKSPACE",
      {
        workspaceName: data.workspaceName,
        invitedByName: data.invitedByName,
        invitedByAvatarUrl: data.invitedByAvatarUrl,
        role: data.role,
        inviteEmail: data.inviteEmail,
      },
      eventId,
    );
  },
};
