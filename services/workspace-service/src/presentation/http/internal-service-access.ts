import {
  assertServiceToServiceAccess,
  SERVICE_IDS,
  SERVICE_SCOPES,
  ServiceAccessDeniedError,
} from '@collabspace/shared';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

function isInternalServiceTokenFallbackEnabled(): boolean {
  const value = process.env.INTERNAL_SERVICE_TOKEN_FALLBACK_ENABLED?.trim();

  if (!value) {
    return true;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/** Validates Service JWT or migration X-Internal-Service-Token for S2S membership. */
export function assertInternalServiceAccess(request: Request): void {
  try {
    assertServiceToServiceAccess({
      headers: request.headers,
      expectedAud: SERVICE_IDS.WORKSPACE,
      requiredScopes: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      allowedIssuers: [SERVICE_IDS.TASK],
      serviceJwtSecret: process.env.SERVICE_JWT_SECRET,
      internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN,
      internalServiceTokenFallbackEnabled:
        isInternalServiceTokenFallbackEnabled(),
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
