import {
  WorkspaceInvitedEventSchema,
  WorkspaceDeletedEventSchema,
  TaskAssignedEventSchema,
  TaskCommentedEventSchema,
  CommentMentionedEventSchema,
  UserRegisteredEventSchema,
  UserProfileUpdatedEventSchema,
} from "@collabspace/shared";
import type {
  WorkspaceInvitedEventPayload,
  WorkspaceDeletedEventPayload,
  TaskAssignedEventPayload,
} from "../../../domain/events";
import type { UserProfileUpdatedEventPayload } from "../../../domain/events/user-profile-update.event";
import type { UserRegisteredEventPayload } from "../../../domain/events/user-create.event";
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
  const result = WorkspaceInvitedEventSchema.safeParse(record);
  if (!result.success) return null;
  return result.data as WorkspaceInvitedEventPayload;
}

export function toWorkspaceDeletedEventPayload(
  record: Record<string, unknown>,
): WorkspaceDeletedEventPayload | null {
  const result = WorkspaceDeletedEventSchema.safeParse(record);
  if (!result.success) return null;
  return result.data as WorkspaceDeletedEventPayload;
}

export function toTaskAssignedEventPayload(
  record: Record<string, unknown>,
): TaskAssignedEventPayload | null {
  const result = TaskAssignedEventSchema.safeParse(record);
  if (!result.success) return null;
  return result.data as TaskAssignedEventPayload;
}

export function toTaskCommentedEventPayload(
  record: Record<string, unknown>,
): TaskCommentedEventPayload | null {
  const result = TaskCommentedEventSchema.safeParse(record);
  if (!result.success) return null;
  return result.data as TaskCommentedEventPayload;
}

export function toCommentMentionedEventPayload(
  record: Record<string, unknown>,
): CommentMentionedNotificationPayload | null {
  const result = CommentMentionedEventSchema.safeParse(record);
  if (!result.success) return null;
  return result.data as CommentMentionedNotificationPayload;
}

export function toUserRegisteredEventPayload(
  record: Record<string, unknown>,
): UserRegisteredEventPayload | null {
  const result = UserRegisteredEventSchema.safeParse(record);
  if (!result.success) return null;
  return result.data as UserRegisteredEventPayload;
}

export function toUserProfileUpdatedEventPayload(
  record: Record<string, unknown>,
): UserProfileUpdatedEventPayload | null {
  const result = UserProfileUpdatedEventSchema.safeParse(record);
  if (!result.success) return null;
  return result.data as UserProfileUpdatedEventPayload;
}
