import jwt from 'jsonwebtoken';
import {
  DEFAULT_SERVICE_JWT_TTL_SECONDS,
  MAX_SERVICE_JWT_TTL_SECONDS,
  SERVICE_JWT_ALGORITHM,
  SERVICE_JWT_CLOCK_SKEW_SECONDS,
} from './service-jwt.constants';
import { ServiceAccessDeniedError } from './service-jwt.errors';

type ServiceJwtPayload = jwt.JwtPayload & {
  scope?: unknown;
};

function normalizeScopeClaim(scope: unknown): string[] {
  if (!Array.isArray(scope)) {
    return [];
  }

  return scope.filter((value): value is string => typeof value === 'string');
}

function readSecret(secret: string): string {
  const trimmed = secret.trim();

  if (!trimmed) {
    throw new ServiceAccessDeniedError(
      'INTERNAL_ACCESS_DENIED',
      'SERVICE_JWT_SECRET is not configured',
    );
  }

  return trimmed;
}

export type SignServiceJwtInput = {
  iss: string;
  aud: string;
  scope: string[];
  secret: string;
  ttlSeconds?: number;
  /** Unix seconds — for tests only. */
  now?: number;
};

export type VerifiedServiceJwt = {
  iss: string;
  aud: string;
  scope: string[];
  iat: number;
  exp: number;
};

export type VerifyServiceJwtInput = {
  token: string;
  secret: string;
  expectedAud: string;
  requiredScopes: string[];
  allowedIssuers: string[];
  /** Unix seconds — for tests only. */
  now?: number;
};

export function extractBearerToken(
  authorizationHeader: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;

  if (!raw?.trim()) {
    return undefined;
  }

  const [scheme, token] = raw.trim().split(/\s+/, 2);

  if (scheme !== 'Bearer' || !token?.trim()) {
    return undefined;
  }

  return token.trim();
}

export function signServiceJwt(input: SignServiceJwtInput): string {
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_SERVICE_JWT_TTL_SECONDS;

  if (ttlSeconds <= 0 || ttlSeconds > MAX_SERVICE_JWT_TTL_SECONDS) {
    throw new Error(`Service JWT ttlSeconds must be between 1 and ${MAX_SERVICE_JWT_TTL_SECONDS}`);
  }

  if (!input.scope.length) {
    throw new Error('Service JWT scope must include at least one value');
  }

  const secret = readSecret(input.secret);
  const now = input.now ?? Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iss: input.iss,
      aud: input.aud,
      scope: input.scope,
      iat: now,
      exp: now + ttlSeconds,
    },
    secret,
    {
      algorithm: SERVICE_JWT_ALGORITHM,
    },
  );
}

export function verifyServiceJwt(input: VerifyServiceJwtInput): VerifiedServiceJwt {
  const secret = readSecret(input.secret);

  try {
    const payload = jwt.verify(input.token, secret, {
      algorithms: [SERVICE_JWT_ALGORITHM],
      clockTolerance: SERVICE_JWT_CLOCK_SKEW_SECONDS,
      complete: false,
      ...(input.now ? { clockTimestamp: input.now } : {}),
    }) as ServiceJwtPayload;

    const iss = payload.iss;
    const aud = payload.aud;
    const iat = payload.iat;
    const exp = payload.exp;
    const scope = normalizeScopeClaim(payload.scope);

    if (typeof iss !== 'string' || !iss.trim()) {
      throw new ServiceAccessDeniedError('INTERNAL_ACCESS_DENIED', 'Service JWT is missing issuer');
    }

    const audience =
      typeof aud === 'string'
        ? aud
        : Array.isArray(aud)
          ? aud.find((value) => typeof value === 'string')
          : undefined;

    if (!audience || audience !== input.expectedAud) {
      throw new ServiceAccessDeniedError(
        'INTERNAL_ACCESS_DENIED',
        'Service JWT audience does not match',
      );
    }

    if (typeof iat !== 'number' || typeof exp !== 'number') {
      throw new ServiceAccessDeniedError(
        'INTERNAL_ACCESS_DENIED',
        'Service JWT is missing iat or exp',
      );
    }

    if (exp - iat > MAX_SERVICE_JWT_TTL_SECONDS) {
      throw new ServiceAccessDeniedError(
        'INTERNAL_ACCESS_DENIED',
        'Service JWT lifetime exceeds allowed maximum',
      );
    }

    if (!input.allowedIssuers.includes(iss)) {
      throw new ServiceAccessDeniedError(
        'SERVICE_JWT_ISSUER_DENIED',
        'Service JWT issuer is not allowed for this route',
      );
    }

    const missingScopes = input.requiredScopes.filter((required) => !scope.includes(required));

    if (missingScopes.length > 0) {
      throw new ServiceAccessDeniedError(
        'SERVICE_JWT_SCOPE_DENIED',
        `Service JWT is missing required scope: ${missingScopes.join(', ')}`,
      );
    }

    return {
      iss,
      aud: audience,
      scope,
      iat,
      exp,
    };
  } catch (error) {
    if (error instanceof ServiceAccessDeniedError) {
      throw error;
    }

    throw new ServiceAccessDeniedError('INTERNAL_ACCESS_DENIED', 'Service JWT verification failed');
  }
}
