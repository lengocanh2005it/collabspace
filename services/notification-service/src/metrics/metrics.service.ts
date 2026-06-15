import { Injectable } from "@nestjs/common";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal: Counter<"method" | "route" | "status">;
  private readonly httpRequestDurationSeconds: Histogram<"method" | "route" | "status">;
  private readonly replicaSyncLagSeconds: Histogram<"source">;
  private readonly replicaFallbackTotal: Counter<"operation">;

  constructor(serviceName: string) {
    this.registry.setDefaultLabels({ service: serviceName });
    collectDefaultMetrics({ register: this.registry, prefix: "collabspace_" });

    this.httpRequestsTotal = new Counter({
      name: "http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "route", "status"],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route", "status"],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.replicaSyncLagSeconds = new Histogram({
      name: "user_replica_sync_lag_seconds",
      help: "Delay between user change event occurredAt and local replica update",
      labelNames: ["source"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 30],
      registers: [this.registry],
    });

    this.replicaFallbackTotal = new Counter({
      name: "user_replica_fallback_total",
      help: "Times a local user replica was hydrated from user-service",
      labelNames: ["operation"],
      registers: [this.registry],
    });
  }

  recordHttpRequest(method: string, route: string, status: number, durationSeconds: number): void {
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  recordReplicaSyncLag(seconds: number, source: "event" | "fallback"): void {
    this.replicaSyncLagSeconds.observe({ source }, seconds);
  }

  recordReplicaFallback(operation: string): void {
    this.replicaFallbackTotal.inc({ operation });
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
