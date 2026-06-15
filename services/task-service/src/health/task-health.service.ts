import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection } from "mongoose";
import { ConfigService } from "@nestjs/config";
import { ConfigurationService } from "../configuration/configuration.service";
import * as amqp from "amqplib";

type CheckStatus = "up" | "down" | "disabled";
type OverallStatus = "ok" | "degraded" | "error";

type HealthCheckResult = {
  detail?: string;
  required: boolean;
  responseTimeMs?: number;
  status: CheckStatus;
};

export type LivenessReport = {
  service: string;
  status: "ok";
  timestamp: string;
  uptimeSeconds: number;
};

export type ReadinessReport = {
  checks: Record<string, HealthCheckResult>;
  mode: "full" | "degraded";
  ready: boolean;
  service: string;
  status: OverallStatus;
  timestamp: string;
};

@Injectable()
export class TaskHealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly configurationService: ConfigurationService,
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

  getLiveness(): LivenessReport {
    return {
      service: "task-service",
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getReadiness(): Promise<ReadinessReport> {
    const rmqConfig = this.configurationService.getRabbitMqConfig();
    const checks: Record<string, HealthCheckResult> = {
      database: await this.runCheck(true, async () => {
        if (this.mongoConnection.readyState !== 1) {
          throw new Error("MongoDB is not connected");
        }

        await this.mongoConnection.db?.admin().command({ ping: 1 });
      }),
      rabbitmq: rmqConfig.enabled
        ? await this.runCheck(false, async () => {
            const connection = await amqp.connect(rmqConfig.url);
            await connection.close();
          })
        : {
            detail: "RabbitMQ publisher is disabled",
            required: false,
            status: "disabled",
          },
      workspaceService:
        this.configService.get<string>("WORKSPACE_CLIENT_MODE") === "http"
          ? await this.runCheck(true, async () => {
              const response = await fetch(
                `${this.configService.get<string>("WORKSPACE_SERVICE_URL") ?? "http://workspace-service:8080"}/api/v1/workspaces/health/live`,
                {
                  signal: AbortSignal.timeout(
                    Number(this.configService.get<string>("WORKSPACE_SERVICE_TIMEOUT_MS") ?? 3000),
                  ),
                },
              );

              if (!response.ok) {
                throw new Error(`Workspace service health returned ${response.status}`);
              }
            })
          : process.env.NODE_ENV === "production"
            ? await this.runCheck(true, async () => {
                throw new Error("Workspace client runs in mock mode (not allowed in production)");
              })
            : {
                detail: "Workspace client runs in mock mode",
                required: false,
                status: "disabled",
              },
      attachmentStorage:
        this.configService.get<string>("NODE_ENV") === "production"
          ? await this.runCheck(true, async () => {
              const connectionString = this.configService.get<string>(
                "AZURE_STORAGE_CONNECTION_STRING",
              );
              if (!connectionString?.trim() || connectionString.includes("your_")) {
                throw new Error("Azure Blob Storage is not configured");
              }
            })
          : {
              detail: "Azure Blob optional in development (mock mode allowed)",
              required: false,
              status: "disabled",
            },
    };

    return this.toReadinessReport("task-service", checks);
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
        status: "up",
      };
    } catch (error) {
      return {
        detail: error instanceof Error ? error.message : "Unknown dependency error",
        required,
        responseTimeMs: Date.now() - startedAt,
        status: "down",
      };
    }
  }

  private toReadinessReport(
    service: string,
    checks: Record<string, HealthCheckResult>,
  ): ReadinessReport {
    const requiredFailure = Object.values(checks).some(
      (check) => check.required && check.status === "down",
    );
    const optionalFailure = Object.values(checks).some(
      (check) => !check.required && check.status === "down",
    );
    const status: OverallStatus = requiredFailure ? "error" : optionalFailure ? "degraded" : "ok";

    return {
      checks,
      mode: status === "ok" ? "full" : "degraded",
      ready: !requiredFailure,
      service,
      status,
      timestamp: new Date().toISOString(),
    };
  }
}
