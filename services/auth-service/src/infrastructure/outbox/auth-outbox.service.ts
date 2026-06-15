import { ConfigurationService } from '@/configuration/configuration.service';
import { unwrapQueryRows } from '@collabspace/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP,
  AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL,
  AuthOutboxEventOrmEntity,
} from '../database/entities/auth-outbox-event.orm-entity';

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

function normalizeClaimedOutboxRow(
  row: Record<string, unknown>,
): ClaimedOutboxEvent | null {
  const rawId = row.id;
  const id =
    typeof rawId === 'string' ? rawId : rawId != null ? String(rawId) : '';
  if (id.length === 0) {
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
    const batchSize =
      limit ?? this.configurationService.getOutboxConfig().batchSize;
    const tablePath = this.dataSource.getMetadata(
      AuthOutboxEventOrmEntity,
    ).tablePath;

    return this.dataSource.transaction(async (manager) => {
      const candidates = unwrapQueryRows<{ id: string }>(
        await manager.query(
          `
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
          `,
          [batchSize],
        ),
      );

      if (candidates.length === 0) {
        return [];
      }

      const ids = candidates.map((row) => row.id);

      await manager.query(
        `
          UPDATE ${tablePath}
          SET claimed_at = NOW(),
              attempt_count = attempt_count + 1,
              updated_at = NOW()
          WHERE id = ANY($1::uuid[])
        `,
        [ids],
      );

      const rows = unwrapQueryRows<Record<string, unknown>>(
        await manager.query(
          `
            SELECT id,
                   event_type AS "eventType",
                   payload,
                   attempt_count AS "attemptCount"
            FROM ${tablePath}
            WHERE id = ANY($1::uuid[])
          `,
          [ids],
        ),
      );

      return rows
        .map((row) => normalizeClaimedOutboxRow(row))
        .filter((row): row is ClaimedOutboxEvent => row !== null);
    });
  }

  async releaseClaimsByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const tablePath = this.dataSource.getMetadata(
      AuthOutboxEventOrmEntity,
    ).tablePath;
    await this.dataSource.query(
      `
        UPDATE ${tablePath}
        SET claimed_at = NULL,
            available_at = NOW(),
            last_error = 'claim normalization release',
            updated_at = NOW()
        WHERE id = ANY($1::uuid[])
          AND processed_at IS NULL
          AND failed_at IS NULL
      `,
      [ids],
    );
  }

  async getStats(): Promise<AuthOutboxStats> {
    const tablePath = this.dataSource.getMetadata(
      AuthOutboxEventOrmEntity,
    ).tablePath;
    const { staleClaimThresholdMs } =
      this.configurationService.getOutboxConfig();
    const rows = unwrapQueryRows<{
      failedCount: number;
      oldestFailedAt: Date | string | null;
      oldestPendingAt: Date | string | null;
      pendingCount: number;
      processedCount: number;
      processingCount: number;
      staleProcessingCount: number;
    }>(
      await this.dataSource.query(
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
      ),
    );

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
    const tablePath = this.dataSource.getMetadata(
      AuthOutboxEventOrmEntity,
    ).tablePath;
    const rows = unwrapQueryRows<{ id: string }>(
      await this.dataSource.query(
        `
        UPDATE ${tablePath}
        SET claimed_at = NULL,
            failed_at = NULL,
            last_error = NULL,
            processed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
        [id],
      ),
    );

    if (rows.length === 0) {
      throw new Error(
        `Outbox event ${id} was not found when marking processed`,
      );
    }
  }

  async markFailed(
    id: string,
    attemptCount: number,
    error: string,
  ): Promise<void> {
    if (typeof id !== 'string' || id.length === 0) {
      return;
    }

    const { maxAttempts } = this.configurationService.getOutboxConfig();
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
      AuthOutboxEventOrmEntity,
    ).tablePath;
    const { staleClaimThresholdMs } =
      this.configurationService.getOutboxConfig();

    const rows = unwrapQueryRows<{ id: string }>(
      await this.dataSource.query(
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
      ),
    );

    return rows.length;
  }

  async markExhaustedClaims(): Promise<number> {
    const tablePath = this.dataSource.getMetadata(
      AuthOutboxEventOrmEntity,
    ).tablePath;
    const { maxAttempts } = this.configurationService.getOutboxConfig();

    const exhaustedRows = unwrapQueryRows<{ id: string }>(
      await this.dataSource.query(
        `
        UPDATE ${tablePath}
        SET claimed_at = NULL,
            failed_at = NOW(),
            last_error = $1,
            updated_at = NOW()
        WHERE processed_at IS NULL
          AND failed_at IS NULL
          AND attempt_count >= $2
        RETURNING id
      `,
        [`outbox publish exceeded max attempts (${maxAttempts})`, maxAttempts],
      ),
    );

    return exhaustedRows.length;
  }

  async releaseInFlightClaimsOnStartup(): Promise<number> {
    const tablePath = this.dataSource.getMetadata(
      AuthOutboxEventOrmEntity,
    ).tablePath;
    const rows = unwrapQueryRows<{ id: string }>(
      await this.dataSource.query(
        `
        UPDATE ${tablePath}
        SET claimed_at = NULL,
            available_at = NOW(),
            last_error = 'startup claim release',
            updated_at = NOW()
        WHERE processed_at IS NULL
          AND failed_at IS NULL
          AND claimed_at IS NOT NULL
        RETURNING id
      `,
      ),
    );

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
    return (manager ?? this.dataSource.manager).getRepository(
      AuthOutboxEventOrmEntity,
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

  async getDevOtp(email: string): Promise<string | null> {
    const rows = unwrapQueryRows<{ otp: string }>(
      await this.dataSource.query(
        `SELECT payload->>'otp' AS otp
       FROM auth_outbox_events
       WHERE event_type = $1
         AND payload->>'email' = $2
       ORDER BY created_at DESC
       LIMIT 1`,
        [AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP, email],
      ),
    );
    return rows[0]?.otp ?? null;
  }

  async getDevPasswordResetToken(email: string): Promise<string | null> {
    const rows = unwrapQueryRows<{ token: string }>(
      await this.dataSource.query(
        `SELECT payload->>'token' AS token
       FROM auth_outbox_events
       WHERE event_type = $1
         AND payload->>'email' = $2
       ORDER BY created_at DESC
       LIMIT 1`,
        [AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL, email],
      ),
    );
    return rows[0]?.token ?? null;
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
