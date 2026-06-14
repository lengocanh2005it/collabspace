import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { getWorkspaceOutboxConfig } from './workspace-outbox.config';
import {
  WORKSPACE_OUTBOX_EVENT_WORKSPACE_DELETED,
  WORKSPACE_OUTBOX_EVENT_WORKSPACE_INVITED,
  WorkspaceOutboxEventEntity,
} from './entities/workspace-outbox-event.entity';

type ClaimedOutboxEvent = {
  attemptCount: number;
  eventType: string;
  id: string;
  payload: Record<string, unknown>;
};

function normalizeClaimedOutboxRow(
  row: Record<string, unknown>,
): ClaimedOutboxEvent | null {
  const id = row.id;
  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }

  const rawEventType = row.eventType ?? row.event_type;
  if (typeof rawEventType !== 'string' || rawEventType.length === 0) {
    return null;
  }

  const rawAttemptCount = row.attemptCount ?? row.attempt_count;
  const attemptCount =
    typeof rawAttemptCount === 'number'
      ? rawAttemptCount
      : Number(rawAttemptCount ?? 0);

  return {
    id,
    eventType: rawEventType,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    attemptCount: Number.isFinite(attemptCount) ? attemptCount : 0,
  };
}

@Injectable()
export class WorkspaceOutboxService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async enqueueWorkspaceInvited(
    payload: Record<string, unknown>,
    manager?: EntityManager,
  ): Promise<void> {
    await this.enqueueEvent(
      WORKSPACE_OUTBOX_EVENT_WORKSPACE_INVITED,
      payload,
      manager,
    );
  }

  async enqueueWorkspaceDeleted(
    payload: Record<string, unknown>,
    manager?: EntityManager,
  ): Promise<void> {
    await this.enqueueEvent(
      WORKSPACE_OUTBOX_EVENT_WORKSPACE_DELETED,
      payload,
      manager,
    );
  }

  async claimPendingBatch(limit?: number): Promise<ClaimedOutboxEvent[]> {
    const { batchSize } = getWorkspaceOutboxConfig();
    const tablePath = this.dataSource.getMetadata(
      WorkspaceOutboxEventEntity,
    ).tablePath;

    const rows = await this.dataSource.query(
      `
        WITH candidate_events AS (
          SELECT id
          FROM ${tablePath}
          WHERE processed_at IS NULL
            AND failed_at IS NULL
            AND claimed_at IS NULL
            AND event_type IS NOT NULL
            AND event_type <> ''
            AND available_at <= NOW()
          ORDER BY created_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE ${tablePath} AS outbox
        SET claimed_at = NOW(),
            attempt_count = outbox.attempt_count + 1,
            updated_at = NOW()
        FROM candidate_events
        WHERE outbox.id = candidate_events.id
        RETURNING outbox.id, outbox.event_type AS "eventType", outbox.payload, outbox.attempt_count AS "attemptCount"
      `,
      [limit ?? batchSize],
    );

    return rows
      .map((row) => normalizeClaimedOutboxRow(row))
      .filter((row): row is ClaimedOutboxEvent => row !== null);
  }

  async markProcessed(id: string): Promise<void> {
    await this.getRepository().update(
      { id },
      {
        claimedAt: null,
        failedAt: null,
        lastError: null,
        processedAt: new Date(),
        updatedAt: new Date(),
      },
    );
  }

  async markFailed(
    id: string,
    attemptCount: number,
    error: string,
  ): Promise<void> {
    if (typeof id !== 'string' || id.length === 0) {
      return;
    }

    const { maxAttempts } = getWorkspaceOutboxConfig();
    const safeAttemptCount = Number.isFinite(attemptCount) ? attemptCount : 1;
    const isPermanentFailure = safeAttemptCount >= maxAttempts;

    await this.getRepository().update(
      { id },
      {
        ...(isPermanentFailure
          ? {}
          : { availableAt: this.getRetryAvailableAt(safeAttemptCount) }),
        claimedAt: null,
        failedAt: isPermanentFailure ? new Date() : null,
        lastError: error,
        updatedAt: new Date(),
      },
    );
  }

  async reclaimStaleClaims(): Promise<number> {
    const tablePath = this.dataSource.getMetadata(
      WorkspaceOutboxEventEntity,
    ).tablePath;
    const { staleClaimThresholdMs } = getWorkspaceOutboxConfig();

    const rows = await this.dataSource.query(
      `
        UPDATE ${tablePath}
        SET claimed_at = NULL,
            available_at = NOW(),
            last_error = $2,
            updated_at = NOW()
        WHERE processed_at IS NULL
          AND failed_at IS NULL
          AND claimed_at IS NOT NULL
          AND claimed_at <= NOW() - (($1::bigint || ' milliseconds')::interval)
        RETURNING id
      `,
      [staleClaimThresholdMs, 'stale claim recovered for retry'],
    );

    return rows.length;
  }

  private getRepository(manager?: EntityManager) {
    return (manager ?? this.dataSource.manager).getRepository(
      WorkspaceOutboxEventEntity,
    );
  }

  private async enqueueEvent(
    eventType: string,
    payload: Record<string, unknown>,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = this.getRepository(manager);
    await repository.save(
      repository.create({
        attemptCount: 0,
        availableAt: new Date(),
        claimedAt: null,
        eventType,
        failedAt: null,
        id: randomUUID(),
        lastError: null,
        payload,
        processedAt: null,
      }),
    );
  }

  private getRetryAvailableAt(attemptCount: number): Date {
    return new Date(Date.now() + this.getRetryDelayMs(attemptCount));
  }

  private getRetryDelayMs(attemptCount: number): number {
    const safeAttemptCount =
      Number.isFinite(attemptCount) && attemptCount > 0 ? attemptCount : 1;
    const baseDelayMs = 5_000;
    const cappedExponent = Math.min(Math.max(safeAttemptCount - 1, 0), 6);
    const delayMs = baseDelayMs * 2 ** cappedExponent;

    return Number.isFinite(delayMs) ? delayMs : baseDelayMs;
  }
}
