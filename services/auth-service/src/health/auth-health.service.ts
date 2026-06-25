import { ConfigurationService } from '@/configuration/configuration.service';
import type { EmailOutboxStats } from '@/domain/ports/email-outbox.port';
import { EMAIL_OUTBOX, type EmailOutbox } from '@/domain/ports/email-outbox.port';
import { OTP_STORE, type OtpStore } from '@/domain/ports/otp-store.port';
import {
  USER_PROFILE_CLIENT,
  type UserProfileClient,
} from '@/domain/ports/user-profile-client.port';
import { DatabaseService } from '@/infrastructure/database/database.service';
import { Inject, Injectable } from '@nestjs/common';

type CheckStatus = 'up' | 'down' | 'disabled';
type OverallStatus = 'ok' | 'degraded' | 'error';

type HealthCheckResult = {
  detail?: string;
  required: boolean;
  responseTimeMs?: number;
  status: CheckStatus;
};

export type LivenessReport = {
  service: string;
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
};

export type ReadinessReport = {
  checks: Record<string, HealthCheckResult>;
  mode: 'full' | 'degraded';
  ready: boolean;
  service: string;
  status: OverallStatus;
  timestamp: string;
};

@Injectable()
export class AuthHealthService {
  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly databaseService: DatabaseService,
    @Inject(EMAIL_OUTBOX)
    private readonly emailOutbox: EmailOutbox,
    @Inject(OTP_STORE)
    private readonly otpStore: OtpStore,
    @Inject(USER_PROFILE_CLIENT)
    private readonly userProfileClient: UserProfileClient,
  ) {}

  getLiveness(): LivenessReport {
    return {
      service: 'auth-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getReadiness(): Promise<ReadinessReport> {
    const outboxConfig = this.configurationService.getOutboxConfig();
    const checks: Record<string, HealthCheckResult> = {
      database: await this.runCheck(true, async () => {
        await this.databaseService.ping();
      }),
      databaseSchema: await this.runCheck(true, async () => {
        await this.databaseService.assertRequiredTables([
          'auth_outbox_events',
          'migrations',
          'permissions',
          'refresh_tokens',
          'role_permissions',
          'roles',
          'user_roles',
          'users',
        ]);
      }),
      outbox: outboxConfig.enabled
        ? await this.runCheck(false, async () => {
            const stats = await this.emailOutbox.getStats();

            if (
              stats.failedCount >= outboxConfig.degradedFailedThreshold ||
              stats.pendingCount >= outboxConfig.degradedPendingThreshold ||
              stats.staleProcessingCount > 0
            ) {
              throw new Error(this.buildOutboxHealthDetail(stats));
            }
          })
        : {
            detail: 'Auth outbox processor is disabled',
            required: false,
            status: 'disabled',
          },
      redis: await this.runCheck(true, async () => {
        const isAlive = await this.otpStore.ping();

        if (!isAlive) {
          throw new Error('Redis ping returned a non-PONG response');
        }
      }),
      userProfilesGrpc: await this.runBoundedCheck(false, 800, async () => {
        await this.userProfileClient.ping();
      }),
      resendEmail:
        process.env.NODE_ENV === 'production'
          ? await this.runCheck(true, async () => {
              if (!this.configurationService.getResendConfig().apiKey?.trim()) {
                throw new Error('RESEND_API_KEY is not configured');
              }
            })
          : {
              detail: 'Resend mock mode allowed outside production',
              required: false,
              status: 'disabled',
            },
    };

    return this.toReadinessReport('auth-service', checks);
  }

  private buildOutboxHealthDetail(stats: EmailOutboxStats): string {
    return [
      `failed=${stats.failedCount}`,
      `pending=${stats.pendingCount}`,
      `processing=${stats.processingCount}`,
      `staleProcessing=${stats.staleProcessingCount}`,
      `oldestPendingAt=${stats.oldestPendingAt ?? 'none'}`,
      `oldestFailedAt=${stats.oldestFailedAt ?? 'none'}`,
    ].join(' ');
  }

  private async runBoundedCheck(
    required: boolean,
    timeoutMs: number,
    operation: () => Promise<void>,
  ): Promise<HealthCheckResult> {
    return this.runCheck(required, async () => {
      await Promise.race([
        operation(),
        new Promise<void>((_resolve, reject) => {
          setTimeout(() => {
            reject(new Error(`Health check timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    });
  }

  private async runCheck(
    required: boolean,
    operation: () => Promise<void>,
  ): Promise<HealthCheckResult> {
    const startedAt = Date.now();

    try {
      await operation();

      return {
        required,
        responseTimeMs: Date.now() - startedAt,
        status: 'up',
      };
    } catch (error) {
      return {
        detail: error instanceof Error ? error.message : 'Unknown dependency error',
        required,
        responseTimeMs: Date.now() - startedAt,
        status: 'down',
      };
    }
  }

  private toReadinessReport(
    service: string,
    checks: Record<string, HealthCheckResult>,
  ): ReadinessReport {
    const requiredFailure = Object.values(checks).some(
      (check) => check.required && check.status === 'down',
    );
    const optionalFailure = Object.values(checks).some(
      (check) => !check.required && check.status === 'down',
    );
    const status: OverallStatus = requiredFailure ? 'error' : optionalFailure ? 'degraded' : 'ok';

    return {
      checks,
      mode: status === 'ok' ? 'full' : 'degraded',
      ready: !requiredFailure,
      service,
      status,
      timestamp: new Date().toISOString(),
    };
  }
}
