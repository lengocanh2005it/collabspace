/**
 * Template Method: shared outbox poll cycle (reclaim → claim → publish → mark).
 * Used by auth, workspace, and task outbox processors.
 */
export interface ClaimedOutboxEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  attemptCount: number;
}

export interface OutboxPollCycleLogger {
  warn(message: string): void;
  error(message: string): void;
}

export interface OutboxPollCycleOptions {
  reclaimStaleClaims: () => Promise<number>;
  claimPendingBatch: () => Promise<ClaimedOutboxEvent[]>;
  publish: (event: ClaimedOutboxEvent) => Promise<void>;
  markProcessed: (id: string) => Promise<void>;
  markFailed: (
    id: string,
    attemptCount: number,
    message: string,
  ) => Promise<void>;
  /** Log label prefix, e.g. "auth outbox" */
  logLabel?: string;
  /** Wrap markFailed in try/catch (auth/workspace); task omits this */
  safeMarkFailed?: boolean;
  onReclaimed?: (count: number) => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown outbox processing error';
}

export async function runOutboxPollCycle(
  options: OutboxPollCycleOptions,
  logger?: OutboxPollCycleLogger,
): Promise<void> {
  const label = options.logLabel ?? 'outbox';

  const reclaimedCount = await options.reclaimStaleClaims();
  if (reclaimedCount > 0) {
    options.onReclaimed?.(reclaimedCount);
    logger?.warn(`Reclaimed ${reclaimedCount} stale ${label} event(s) for retry`);
  }

  const events = await options.claimPendingBatch();

  for (const event of events) {
    try {
      await options.publish(event);
      await options.markProcessed(event.id);
    } catch (error) {
      const message = errorMessage(error);
      logger?.warn(
        `${label} publish failed for ${event.id} (${event.eventType}): ${message}`,
      );

      if (options.safeMarkFailed) {
        try {
          await options.markFailed(event.id, event.attemptCount, message);
        } catch (markFailedError) {
          logger?.error(
            `${label} markFailed error for ${event.id}: ${errorMessage(markFailedError)}`,
          );
        }
      } else {
        await options.markFailed(event.id, event.attemptCount, message);
      }
    }
  }
}
