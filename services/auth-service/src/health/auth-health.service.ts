import { ConfigurationService } from '@/configuration/configuration.service';
import { UserProfilesGrpcService } from '@/modules/identity/user-profiles-grpc.service';
import { DatabaseService } from '@/modules/database/database.service';
import { AuthOutboxService } from '@/modules/outbox/auth-outbox.service';
import { RedisService } from '@/modules/redis/redis.service';
import { Injectable } from '@nestjs/common';

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
    private readonly authOutboxService: AuthOutboxService,
    private readonly redisService: RedisService,
    private readonly userProfilesGrpcService: UserProfilesGrpcService,
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
      outbox:
        outboxConfig.enabled
          ? await this.runCheck(false, async () => {
              const stats = await this.authOutboxService.getStats();

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
        const isAlive = await this.redisService.ping();

        if (!isAlive) {
          throw new Error('Redis ping returned a non-PONG response');
        }
      }),
      userProfilesGrpc: await this.runCheck(true, async () => {
        await this.userProfilesGrpcService.ping();
      }),
    };

    return this.toReadinessReport('auth-service', checks);
  }

  private buildOutboxHealthDetail(
    stats: Awaited<ReturnType<AuthOutboxService['getStats']>>,
  ): string {
    return [
      `failed=${stats.failedCount}`,
      `pending=${stats.pendingCount}`,
      `processing=${stats.processingCount}`,
      `staleProcessing=${stats.staleProcessingCount}`,
      `oldestPendingAt=${stats.oldestPendingAt ?? 'none'}`,
      `oldestFailedAt=${stats.oldestFailedAt ?? 'none'}`,
    ].join(' ');
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
    const status: OverallStatus = requiredFailure
      ? 'error'
      : optionalFailure
        ? 'degraded'
        : 'ok';

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
