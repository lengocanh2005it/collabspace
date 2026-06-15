import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../infrastructure/database/database.service';

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
export class WorkspaceHealthService {
  constructor(private readonly databaseService: DatabaseService) {}

  getLiveness(): LivenessReport {
    return {
      service: 'workspace-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getReadiness(): Promise<ReadinessReport> {
    const checks: Record<string, HealthCheckResult> = {
      database: await this.runCheck(true, async () => {
        const isAlive = await this.databaseService.ping();

        if (!isAlive) {
          throw new Error('Database is not initialized');
        }
      }),
    };

    return this.toReadinessReport('workspace-service', checks);
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
