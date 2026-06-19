const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export type WorkspaceOutboxPublishMode = 'rabbitmq' | 'debezium';

export type WorkspaceOutboxConfig = {
  batchSize: number;
  enabled: boolean;
  maxAttempts: number;
  pollIntervalMs: number;
  publishMode: WorkspaceOutboxPublishMode;
  staleClaimThresholdMs: number;
};

export const getWorkspaceOutboxPublishMode = (): WorkspaceOutboxPublishMode => {
  const raw = process.env.WORKSPACE_OUTBOX_PUBLISH_MODE?.toLowerCase();
  if (raw === 'debezium') {
    return 'debezium';
  }

  return 'rabbitmq';
};

export const getWorkspaceOutboxConfig = (): WorkspaceOutboxConfig => ({
  batchSize: toNumber(process.env.WORKSPACE_OUTBOX_BATCH_SIZE, 25),
  enabled: toBoolean(process.env.WORKSPACE_OUTBOX_ENABLED, true),
  maxAttempts: toNumber(process.env.WORKSPACE_OUTBOX_MAX_ATTEMPTS, 8),
  pollIntervalMs: toNumber(process.env.WORKSPACE_OUTBOX_POLL_INTERVAL_MS, 2000),
  publishMode: getWorkspaceOutboxPublishMode(),
  staleClaimThresholdMs: toNumber(process.env.WORKSPACE_OUTBOX_STALE_CLAIM_THRESHOLD_MS, 60_000),
});
