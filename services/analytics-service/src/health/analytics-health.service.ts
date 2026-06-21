import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { ConfigurationService } from '../config/configuration.service.js';

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
export class AnalyticsHealthService {
  constructor(
    private readonly configurationService: ConfigurationService,
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

  getLiveness(): LivenessReport {
    return {
      service: 'analytics-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getReadiness(): Promise<ReadinessReport> {
    const kafkaConfig = this.configurationService.getKafkaConfig();

    const checks: Record<string, HealthCheckResult> = {
      database: await this.runCheck(true, async () => {
        if (this.mongoConnection.readyState !== 1) {
          throw new Error('MongoDB is not connected');
        }

        await this.mongoConnection.db?.admin().command({ ping: 1 });
      }),
      kafka: kafkaConfig.enabled
        ? {
            detail: `Kafka consumers enabled (${kafkaConfig.brokers.join(',')})`,
            required: false,
            status: 'up',
          }
        : {
            detail: 'Kafka consumers disabled (KAFKA_CONSUMERS_ENABLED=false)',
            required: false,
            status: 'disabled',
          },
    };

    return this.toReadinessReport('analytics-service', checks);
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
    const requiredFailure = Object.values(checks).some((c) => c.required && c.status === 'down');
    const optionalFailure = Object.values(checks).some((c) => !c.required && c.status === 'down');
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
