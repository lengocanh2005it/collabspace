import type { WorkspaceInvitedEventPayload } from "../../../domain/events/workspace-events";

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
