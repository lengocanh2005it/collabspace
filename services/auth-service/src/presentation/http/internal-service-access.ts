import {
  assertServiceToServiceAccess,
  SERVICE_IDS,
  ServiceAccessDeniedError,
} from '@collabspace/shared';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

const AUTH_ACCOUNTS_READ_SCOPE = 'auth.accounts.read';

/** Validates Service JWT for workspace-service account lookup. */
export function assertInternalServiceAccess(request: Request): void {
  try {
    assertServiceToServiceAccess({
      headers: request.headers,
      expectedAud: 'auth-service',
      requiredScopes: [AUTH_ACCOUNTS_READ_SCOPE],
      allowedIssuers: [SERVICE_IDS.WORKSPACE],
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
