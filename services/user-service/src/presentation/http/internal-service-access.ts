import {
  assertServiceToServiceAccess,
  SERVICE_IDS,
  SERVICE_SCOPES,
  ServiceAccessDeniedError,
} from '@collabspace/shared';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/** Validates Service JWT for S2S replica lookup. */
export function assertInternalServiceAccess(request: Request): void {
  try {
    assertServiceToServiceAccess({
      headers: request.headers,
      expectedAud: SERVICE_IDS.USER,
      requiredScopes: [SERVICE_SCOPES.USER_REPLICAS_READ],
      allowedIssuers: [SERVICE_IDS.TASK, SERVICE_IDS.NOTIFICATION],
      serviceJwtSecret: process.env.SERVICE_JWT_SECRET,
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (error) {
    if (error instanceof ServiceAccessDeniedError) {
      throw new UnauthorizedException({
        code: error.code,
        message: error.message,
      });
    }

    throw error;
  }
}
