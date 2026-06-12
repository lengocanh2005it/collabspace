import { ConfigurationService } from '@/configuration/configuration.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import {
  DataSource,
  EntityManager,
} from 'typeorm';
import {
  AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP,
  AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL,
  AuthOutboxEventEntity,
} from './entities/auth-outbox-event.entity';

type AuthEmailVerificationOtpOutboxPayload = {
  email: string;
  otp: string;
  otpTtlSeconds: number;
  userId: string;
};

type AuthPasswordResetEmailOutboxPayload = {
  email: string;
  token: string;
  ttlSeconds: number;
  userId: string;
};

type ClaimedOutboxEvent = {
  attemptCount: number;
  eventType: string;
  id: string;
  payload: Record<string, unknown>;
};

export type AuthOutboxStats = {
  failedCount: number;
  oldestFailedAt: string | null;
  oldestPendingAt: string | null;
  pendingCount: number;
  processedCount: number;
  processingCount: number;
  staleProcessingCount: number;
};

@Injectable()
export class AuthOutboxService {
  constructor(
    private readonly configurationService: ConfigurationService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async enqueueEmailVerificationOtp(
    payload: AuthEmailVerificationOtpOutboxPayload,
    manager?: EntityManager,
  ): Promise<void> {
    await this.enqueueEvent(
      AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP,
      payload,
      manager,
    );
  }

  async enqueuePasswordResetEmail(
    payload: AuthPasswordResetEmailOutboxPayload,
    manager?: EntityManager,
  ): Promise<void> {
    await this.enqueueEvent(
      AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL,
      payload,
      manager,
    );
  }

  async claimPendingBatch(limit?: number): Promise<ClaimedOutboxEvent[]> {
    const batchSize = limit ?? this.configurationService.getOutboxConfig().batchSize;
    const tablePath = this.dataSource.getMetadata(AuthOutboxEventEntity).tablePath;

    const rows = (await this.dataSource.query(
      `
        WITH candidate_events AS (
          SELECT id
          FROM ${tablePath}
          WHERE processed_at IS NULL
            AND failed_at IS NULL
            AND claimed_at IS NULL
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
      [batchSize],
    )) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: String(row.id),
      eventType: String(row.eventType ?? row.event_type),
      payload: (row.payload ?? {}) as Record<string, unknown>,
      attemptCount: Number(row.attemptCount ?? row.attempt_count ?? 0),
    }));
  }

  async getStats(): Promise<AuthOutboxStats> {
    const tablePath = this.dataSource.getMetadata(AuthOutboxEventEntity).tablePath;
    const { staleClaimThresholdMs } = this.configurationService.getOutboxConfig();
    const rows = (await this.dataSource.query(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE processed_at IS NULL
              AND failed_at IS NULL
              AND claimed_at IS NULL
          )::int AS "pendingCount",
          COUNT(*) FILTER (
            WHERE processed_at IS NULL
              AND failed_at IS NULL
              AND claimed_at IS NOT NULL
          )::int AS "processingCount",
          COUNT(*) FILTER (
            WHERE processed_at IS NULL
              AND failed_at IS NOT NULL
          )::int AS "failedCount",
          COUNT(*) FILTER (
            WHERE processed_at IS NOT NULL
          )::int AS "processedCount",
          COUNT(*) FILTER (
            WHERE processed_at IS NULL
              AND failed_at IS NULL
              AND claimed_at IS NOT NULL
              AND claimed_at <= NOW() - (($1::bigint || ' milliseconds')::interval)
          )::int AS "staleProcessingCount",
          MIN(created_at) FILTER (
            WHERE processed_at IS NULL
              AND failed_at IS NULL
              AND claimed_at IS NULL
          ) AS "oldestPendingAt",
          MIN(failed_at) FILTER (
            WHERE processed_at IS NULL
              AND failed_at IS NOT NULL
          ) AS "oldestFailedAt"
        FROM ${tablePath}
      `,
      [staleClaimThresholdMs],
    )) as Array<{
      failedCount: number;
      oldestFailedAt: Date | string | null;
      oldestPendingAt: Date | string | null;
      pendingCount: number;
      processedCount: number;
      processingCount: number;
      staleProcessingCount: number;
    }>;

    const row = rows[0] ?? {
      failedCount: 0,
      oldestFailedAt: null,
      oldestPendingAt: null,
      pendingCount: 0,
      processedCount: 0,
      processingCount: 0,
      staleProcessingCount: 0,
    };

    return {
      failedCount: Number(row.failedCount ?? 0),
      oldestFailedAt: this.toIsoString(row.oldestFailedAt),
      oldestPendingAt: this.toIsoString(row.oldestPendingAt),
      pendingCount: Number(row.pendingCount ?? 0),
      processedCount: Number(row.processedCount ?? 0),
      processingCount: Number(row.processingCount ?? 0),
      staleProcessingCount: Number(row.staleProcessingCount ?? 0),
    };
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
    const { maxAttempts } = this.configurationService.getOutboxConfig();
    const isPermanentFailure = attemptCount >= maxAttempts;

    const safeAttemptCount = Number.isFinite(attemptCount) ? attemptCount : 1;

    await this.getRepository().update(
      { id },
      {
        availableAt: isPermanentFailure
          ? undefined
          : new Date(Date.now() + this.getRetryDelayMs(safeAttemptCount)),
        claimedAt: null,
        failedAt: isPermanentFailure ? new Date() : null,
        lastError: error,
        updatedAt: new Date(),
      },
    );
  }

  async reclaimStaleClaims(): Promise<number> {
    const tablePath = this.dataSource.getMetadata(AuthOutboxEventEntity).tablePath;
    const { staleClaimThresholdMs } = this.configurationService.getOutboxConfig();
    const rows = (await this.dataSource.query(
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
    )) as Array<{ id: string }>;

    return rows.length;
  }

  async replayFailedEvent(id: string): Promise<void> {
    const event = await this.getRepository().findOneBy({ id });

    if (!event) {
      throw new NotFoundException({
        code: 'AUTH_OUTBOX_EVENT_NOT_FOUND',
        message: `Outbox event ${id} was not found`,
      });
    }

    if (!event.failedAt) {
      throw new NotFoundException({
        code: 'AUTH_OUTBOX_EVENT_NOT_FAILED',
        message: `Outbox event ${id} is not in failed state`,
      });
    }

    await this.getRepository().update(
      {
        id,
      },
      {
        availableAt: new Date(),
        claimedAt: null,
        failedAt: null,
        lastError: null,
        updatedAt: new Date(),
      },
    );
  }

  private getRepository(manager?: EntityManager) {
    return (manager ?? this.dataSource.manager).getRepository(AuthOutboxEventEntity);
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

  private getRetryDelayMs(attemptCount: number): number {
    const baseDelayMs = 5_000;
    const cappedExponent = Math.min(Math.max(attemptCount - 1, 0), 6);
    return baseDelayMs * 2 ** cappedExponent;
  }

  private toIsoString(value: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return new Date(value).toISOString();
  }
}
