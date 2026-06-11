import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/** Validates X-Internal-Service-Token for service-to-service replica hydration. */
export function assertInternalServiceAccess(request: Request): void {
  const expected = process.env.INTERNAL_SERVICE_TOKEN?.trim();

  if (!expected) {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    throw new UnauthorizedException({
      code: 'INTERNAL_ACCESS_DENIED',
      message: 'INTERNAL_SERVICE_TOKEN is not configured',
    });
  }

  const header = request.headers['x-internal-service-token'];
  const token = typeof header === 'string' ? header.trim() : undefined;

  if (token !== expected) {
    throw new UnauthorizedException({
      code: 'INTERNAL_ACCESS_DENIED',
      message: 'Valid internal service credentials are required',
    });
  }
}
