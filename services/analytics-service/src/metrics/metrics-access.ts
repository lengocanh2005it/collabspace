import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

export function assertMetricsAccess(request: Request): void {
  const expected = process.env.METRICS_AUTH_TOKEN?.trim();

  if (!expected) {
    return;
  }

  const authorization = request.headers.authorization;
  const bearer =
    typeof authorization === 'string'
      ? authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
      : undefined;
  const headerToken = request.headers['x-metrics-token'];
  const plainToken = typeof headerToken === 'string' ? headerToken.trim() : undefined;

  if (bearer === expected || plainToken === expected) {
    return;
  }

  throw new UnauthorizedException({
    code: 'METRICS_ACCESS_DENIED',
    message: 'Valid metrics credentials are required',
  });
}
