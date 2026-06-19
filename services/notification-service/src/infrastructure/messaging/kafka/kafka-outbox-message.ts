import type {
  WorkspaceDeletedEventPayload,
  WorkspaceInvitedEventPayload,
} from "../../../domain/events/workspace-events";
import type { UserProfileUpdatedEventPayload } from "../../../domain/events/user-profile-update.event";
import type { UserRegisteredEventPayload } from "../../../domain/events/user-create.event";

/**
 * Debezium Outbox Event Router with expand.json.payload emits the domain JSON as the value.
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
    const parsed: unknown = JSON.parse(raw);
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
