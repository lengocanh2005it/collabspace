import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

export function registerMetricsMiddleware(
  app: INestApplication,
  metricsService: MetricsService,
): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
      const routePath = (req as Request & { route?: { path?: string } }).route?.path;
      const route = typeof routePath === 'string' ? routePath : req.path;
      metricsService.recordHttpRequest(req.method, route, res.statusCode, durationSeconds);
    });
    next();
  });
}
