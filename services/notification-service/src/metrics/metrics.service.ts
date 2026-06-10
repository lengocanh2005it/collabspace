import { Injectable } from "@nestjs/common";
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client";

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal: Counter<"method" | "route" | "status">;
  private readonly httpRequestDurationSeconds: Histogram<
    "method" | "route" | "status"
  >;

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
  }

  recordHttpRequest(
    method: string,
    route: string,
    status: number,
    durationSeconds: number,
  ): void {
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
