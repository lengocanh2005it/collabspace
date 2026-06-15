import { CreateNotificationCommand } from "../usecases/create-notification/create-notification.command";
import { NotificationType } from "../../domain/value-objects/NotificationType";
import type { TaskAssignedEventPayload } from "../../domain/events/task-events";
import type {
  CommentMentionedNotificationPayload,
  TaskCommentedEventPayload,
} from "../../domain/events/comment-events";
import type {
  WorkspaceInvitedEventPayload,
  WorkspaceDeletedEventPayload,
} from "../../domain/events/workspace-events";

/**
 * Factory / Mapper: inbound RabbitMQ event payloads → CreateNotificationCommand.
 */
export const InboundNotificationEventMapper = {
  toTaskAssignedCommand(data: TaskAssignedEventPayload): CreateNotificationCommand {
    const eventId =
      data.eventId ?? `task_assigned:${data.taskId}:${data.recipientId}:${data.assignedAt}`;

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

  toTaskCommentedCommand(data: TaskCommentedEventPayload): CreateNotificationCommand {
    const eventId = data.eventId ?? `comment_created:${data.commentId}:${data.recipientId}`;

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

  toCommentMentionedCommand(data: CommentMentionedNotificationPayload): CreateNotificationCommand {
    const eventId = data.eventId ?? `comment_mentioned:${data.commentId}:${data.recipientId}`;

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

  toWorkspaceDeletedCommand(
    data: WorkspaceDeletedEventPayload,
    recipientId: string,
  ): CreateNotificationCommand {
    const eventId =
      data.eventId ?? `workspace_deleted:${data.workspaceId}:${recipientId}:${data.occurredAt}`;

    return new CreateNotificationCommand(
      recipientId,
      data.deletedById,
      NotificationType.WORKSPACE_DELETED,
      "Workspace đã bị xóa",
      `Workspace của bạn đã bị xóa`,
      data.workspaceId,
      "WORKSPACE",
      { workspaceId: data.workspaceId },
      eventId,
    );
  },

  toWorkspaceInvitedCommand(data: WorkspaceInvitedEventPayload): CreateNotificationCommand | null {
    const recipientId = data.recipientId ?? data.invitedUserId;

    if (!recipientId?.trim()) {
      return null;
    }

    const actorName = data.invitedByName?.trim() || "Someone";
    const workspaceName = data.workspaceName?.trim() || "a workspace";
    const eventId =
      data.eventId ??
      `workspace_invited:${data.workspaceId}:${recipientId}:${data.inviteEmail ?? "unknown"}`;

    return new CreateNotificationCommand(
      recipientId,
      data.invitedById,
      NotificationType.WORKSPACE_INVITED,
      "Lời mời vào workspace",
      `${actorName} đã mời bạn vào workspace "${workspaceName}"`,
      data.workspaceId,
      "WORKSPACE",
      {
        workspaceName,
        invitedByName: data.invitedByName,
        invitedByAvatarUrl: data.invitedByAvatarUrl,
        role: data.role,
        inviteEmail: data.inviteEmail,
        invitationId: data.invitationId,
      },
      eventId,
    );
  },
};
