import type {
  WorkspaceDeletedEventPayload,
  WorkspaceInvitedEventPayload,
} from "../../../domain/events/workspace-events";
import type { UserProfileUpdatedEventPayload } from "../../../domain/events/user-profile-update.event";
import type { UserRegisteredEventPayload } from "../../../domain/events/user-create.event";
import type { TaskAssignedEventPayload } from "../../../domain/events/task-events";
import type {
  CommentMentionedNotificationPayload,
  TaskCommentedEventPayload,
} from "../../../domain/events/comment-events";

/**
 * Debezium Outbox Event Router value parser.
 * Postgres (expand.json.payload): domain object JSON.
 * Mongo MongoEventRouter: payload may arrive as a JSON-encoded string — parse twice.
 */
export function parseKafkaOutboxJsonValue(
  value: Buffer | string | null | undefined,
): Record<string, unknown> | null {
  if (value == null) {
    return null;
  }

  const raw = typeof value === "string" ? value : value.toString("utf8");
  if (raw.trim().length === 0) {
    return null;
  }

  try {
    let parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string") {
      const inner = parsed.trim();
      if (inner.startsWith("{") || inner.startsWith("[")) {
        parsed = JSON.parse(inner);
      }
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

export function toWorkspaceInvitedEventPayload(
  record: Record<string, unknown>,
): WorkspaceInvitedEventPayload | null {
  const workspaceId = record.workspaceId;
  const invitedById = record.invitedById;

  if (typeof workspaceId !== "string" || workspaceId.length === 0) {
    return null;
  }

  if (typeof invitedById !== "string" || invitedById.length === 0) {
    return null;
  }

  return record as unknown as WorkspaceInvitedEventPayload;
}

export function toWorkspaceDeletedEventPayload(
  record: Record<string, unknown>,
): WorkspaceDeletedEventPayload | null {
  const workspaceId = record.workspaceId;
  const deletedById = record.deletedById;

  if (typeof workspaceId !== "string" || workspaceId.length === 0) {
    return null;
  }

  if (typeof deletedById !== "string" || deletedById.length === 0) {
    return null;
  }

  return record as unknown as WorkspaceDeletedEventPayload;
}

export function toUserProfileUpdatedEventPayload(
  record: Record<string, unknown>,
): UserProfileUpdatedEventPayload | null {
  const userId = record.userId;

  if (typeof userId !== "string" || userId.length === 0) {
    return null;
  }

  return record as unknown as UserProfileUpdatedEventPayload;
}

export function toUserRegisteredEventPayload(
  record: Record<string, unknown>,
): UserRegisteredEventPayload | null {
  const userId = record.userId;
  const fullName = record.fullName;

  if (typeof userId !== "string" || userId.length === 0) {
    return null;
  }

  if (typeof fullName !== "string" || fullName.length === 0) {
    return null;
  }

  return record as unknown as UserRegisteredEventPayload;
}

export function toTaskAssignedEventPayload(
  record: Record<string, unknown>,
): TaskAssignedEventPayload | null {
  const taskId = record.taskId;
  const recipientId = record.recipientId;

  if (typeof taskId !== "string" || taskId.length === 0) {
    return null;
  }

  if (typeof recipientId !== "string" || recipientId.length === 0) {
    return null;
  }

  return record as unknown as TaskAssignedEventPayload;
}

export function toTaskCommentedEventPayload(
  record: Record<string, unknown>,
): TaskCommentedEventPayload | null {
  const taskId = record.taskId;
  const commentId = record.commentId;
  const recipientId = record.recipientId;

  if (typeof taskId !== "string" || taskId.length === 0) {
    return null;
  }

  if (typeof commentId !== "string" || commentId.length === 0) {
    return null;
  }

  if (typeof recipientId !== "string" || recipientId.length === 0) {
    return null;
  }

  return record as unknown as TaskCommentedEventPayload;
}

export function toCommentMentionedEventPayload(
  record: Record<string, unknown>,
): CommentMentionedNotificationPayload | null {
  const taskId = record.taskId;
  const commentId = record.commentId;
  const recipientId = record.recipientId;

  if (typeof taskId !== "string" || taskId.length === 0) {
    return null;
  }

  if (typeof commentId !== "string" || commentId.length === 0) {
    return null;
  }

  if (typeof recipientId !== "string" || recipientId.length === 0) {
    return null;
  }

  return record as unknown as CommentMentionedNotificationPayload;
}
