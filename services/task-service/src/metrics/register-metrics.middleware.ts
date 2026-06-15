import type { INestApplication } from "@nestjs/common";
import type { MetricsService } from "./metrics.service";

export function registerMetricsMiddleware(
  app: INestApplication,
  metricsService: MetricsService,
): void {
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
      const route = (req as { route?: { path?: string } }).route?.path ?? req.path;
      metricsService.recordHttpRequest(req.method, route, res.statusCode, durationSeconds);
    });
    next();
  });
}
