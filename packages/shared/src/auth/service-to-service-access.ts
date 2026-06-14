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
  nodeEnv?: string;
};

export type AssertServiceToServiceAccessResult = {
  method: 'service-jwt' | 'development-bypass';
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
    options.nodeEnv === 'development' && !options.serviceJwtSecret?.trim()
  );
}

/**
 * Validates inbound S2S HTTP auth via Service JWT Bearer token.
 * Throws {@link ServiceAccessDeniedError} — map to HTTP 401 in Nest controllers.
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

  if (isDevelopmentBypassAllowed(options)) {
    return { method: 'development-bypass' };
  }

  throw new ServiceAccessDeniedError(
    'INTERNAL_ACCESS_DENIED',
    'Valid service JWT credentials are required',
  );
}
