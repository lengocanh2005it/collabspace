import { ConfigurationService } from '@/configuration/configuration.service';
import { UserProfilesGrpcService } from '@/modules/identity/user-profiles-grpc.service';
import { DatabaseService } from '@/modules/database/database.service';
import { RabbitMqEventsService } from '@/modules/rabbitmq/rabbitmq-events.service';
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
    private readonly redisService: RedisService,
    private readonly rabbitMqEventsService: RabbitMqEventsService,
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
    const rabbitMqConfig = this.configurationService.getRabbitMqConfig();
    const checks: Record<string, HealthCheckResult> = {
      database: await this.runCheck(true, async () => {
        await this.databaseService.ping();
      }),
      redis: await this.runCheck(true, async () => {
        const isAlive = await this.redisService.ping();

        if (!isAlive) {
          throw new Error('Redis ping returned a non-PONG response');
        }
      }),
      rabbitmq:
        rabbitMqConfig.enabled && rabbitMqConfig.url
          ? await this.runCheck(false, async () => {
              await this.rabbitMqEventsService.ping();
            })
          : {
              detail: 'RabbitMQ publishing is disabled',
              required: false,
              status: 'disabled',
            },
      userProfilesGrpc: await this.runCheck(false, async () => {
        await this.userProfilesGrpcService.ping();
      }),
    };

    return this.toReadinessReport('auth-service', checks);
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
