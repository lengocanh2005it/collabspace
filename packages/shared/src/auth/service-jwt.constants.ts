/** Canonical service identifiers for `iss` / `aud` claims. */
export const SERVICE_IDS = {
  TASK: 'task-service',
  NOTIFICATION: 'notification-service',
  WORKSPACE: 'workspace-service',
  USER: 'user-service',
} as const;

export type ServiceId = (typeof SERVICE_IDS)[keyof typeof SERVICE_IDS];

/** Scopes for the HTTP internal slice (Phase 0 contract). */
export const SERVICE_SCOPES = {
  WORKSPACE_MEMBERSHIP_READ: 'workspace.membership.read',
  USER_REPLICAS_READ: 'user.replicas.read',
} as const;

export type ServiceScope = (typeof SERVICE_SCOPES)[keyof typeof SERVICE_SCOPES];

export const DEFAULT_SERVICE_JWT_TTL_SECONDS = 300;
export const MAX_SERVICE_JWT_TTL_SECONDS = 300;
export const SERVICE_JWT_CLOCK_SKEW_SECONDS = 30;
export const SERVICE_JWT_ALGORITHM = 'HS256' as const;
