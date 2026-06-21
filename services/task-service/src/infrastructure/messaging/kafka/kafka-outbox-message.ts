import {
  WorkspaceDeletedEventSchema,
  UserRegisteredEventSchema,
  UserProfileUpdatedEventSchema,
} from "@collabspace/shared";
import type { WorkspaceDeletedEventPayload } from "@collabspace/shared";
import type { UserProfileUpdatedEventPayload } from "../../../domain/events/user-profile-update.event";
import type { UserRegisteredEventPayload } from "../../../domain/events/user-create.event";

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

export function toWorkspaceDeletedEventPayload(
  record: Record<string, unknown>,
): WorkspaceDeletedEventPayload | null {
  const result = WorkspaceDeletedEventSchema.safeParse(record);
  if (!result.success) return null;
  return result.data;
}

export function toUserRegisteredEventPayload(
  record: Record<string, unknown>,
): UserRegisteredEventPayload | null {
  const result = UserRegisteredEventSchema.safeParse(record);
  if (!result.success) return null;
  return result.data;
}

export function toUserProfileUpdatedEventPayload(
  record: Record<string, unknown>,
): UserProfileUpdatedEventPayload | null {
  const result = UserProfileUpdatedEventSchema.safeParse(record);
  if (!result.success) return null;
  return result.data;
}
