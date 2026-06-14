import { extractBearerToken, verifyServiceJwt } from './service-jwt';
import type { VerifiedServiceJwt } from './service-jwt';
import { ServiceAccessDeniedError } from './service-jwt.errors';

export type ServiceToServiceRequestHeaders = Record<
  string,
  string | string[] | undefined
>;

export type AssertServiceToServiceAccessOptions = {
  headers: ServiceToServiceRequestHeaders;
  expectedAud: string;
  requiredScopes: string[];
  allowedIssuers: string[];
  serviceJwtSecret?: string;
  internalServiceToken?: string;
  /** Default `true` during migration when omitted. */
  internalServiceTokenFallbackEnabled?: boolean;
  nodeEnv?: string;
};

export type AssertServiceToServiceAccessResult = {
  method: 'service-jwt' | 'internal-token' | 'development-bypass';
  verifiedJwt?: VerifiedServiceJwt;
};

function readHeader(
  headers: ServiceToServiceRequestHeaders,
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()] ?? headers[name];

  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}

function isDevelopmentBypassAllowed(
  options: AssertServiceToServiceAccessOptions,
): boolean {
  return (
    options.nodeEnv === 'development' &&
    !options.serviceJwtSecret?.trim() &&
    !options.internalServiceToken?.trim()
  );
}

function assertInternalServiceToken(
  options: AssertServiceToServiceAccessOptions,
): void {
  const expected = options.internalServiceToken?.trim();

  if (!expected) {
    if (isDevelopmentBypassAllowed(options)) {
      return;
    }

    throw new ServiceAccessDeniedError(
      'INTERNAL_ACCESS_DENIED',
      'INTERNAL_SERVICE_TOKEN is not configured',
    );
  }

  const token = readHeader(options.headers, 'x-internal-service-token');

  if (token !== expected) {
    throw new ServiceAccessDeniedError(
      'INTERNAL_ACCESS_DENIED',
      'Valid internal service credentials are required',
    );
  }
}

/**
 * Validates inbound S2S HTTP auth: Service JWT first, then legacy internal token.
 * Throws {@link ServiceAccessDeniedError} — map to HTTP 401 in Nest controllers (Phase 2+).
 */
export function assertServiceToServiceAccess(
  options: AssertServiceToServiceAccessOptions,
): AssertServiceToServiceAccessResult {
  const bearerToken = extractBearerToken(
    readHeader(options.headers, 'authorization'),
  );
  const serviceJwtSecret = options.serviceJwtSecret?.trim();

  if (bearerToken) {
    if (!serviceJwtSecret) {
      throw new ServiceAccessDeniedError(
        'INTERNAL_ACCESS_DENIED',
        'SERVICE_JWT_SECRET is not configured',
      );
    }

    const verifiedJwt = verifyServiceJwt({
      token: bearerToken,
      secret: serviceJwtSecret,
      expectedAud: options.expectedAud,
      requiredScopes: options.requiredScopes,
      allowedIssuers: options.allowedIssuers,
    });

    return {
      method: 'service-jwt',
      verifiedJwt,
    };
  }

  const fallbackEnabled =
    options.internalServiceTokenFallbackEnabled ?? true;

  if (fallbackEnabled) {
    if (isDevelopmentBypassAllowed(options)) {
      return { method: 'development-bypass' };
    }

    assertInternalServiceToken(options);
    return { method: 'internal-token' };
  }

  if (isDevelopmentBypassAllowed(options)) {
    return { method: 'development-bypass' };
  }

  throw new ServiceAccessDeniedError(
    'INTERNAL_ACCESS_DENIED',
    'Valid internal service credentials are required',
  );
}
