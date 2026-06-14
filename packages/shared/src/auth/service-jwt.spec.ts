import {
  DEFAULT_SERVICE_JWT_TTL_SECONDS,
  SERVICE_IDS,
  SERVICE_SCOPES,
} from './service-jwt.constants';
import { ServiceAccessDeniedError } from './service-jwt.errors';
import {
  extractBearerToken,
  signServiceJwt,
  verifyServiceJwt,
} from './service-jwt';

const SECRET = 'phase-1-test-service-jwt-secret';
const NOW = 1_710_000_000;

describe('extractBearerToken', () => {
  it('returns token for Bearer scheme', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('returns undefined for missing or invalid header', () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
    expect(extractBearerToken('Basic abc')).toBeUndefined();
    expect(extractBearerToken('Bearer')).toBeUndefined();
  });

  it('uses first value when header is an array', () => {
    expect(extractBearerToken(['Bearer token-1', 'Bearer token-2'])).toBe(
      'token-1',
    );
  });
});

describe('signServiceJwt / verifyServiceJwt', () => {
  it('signs and verifies a valid service JWT', () => {
    const token = signServiceJwt({
      iss: SERVICE_IDS.TASK,
      aud: SERVICE_IDS.WORKSPACE,
      scope: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      secret: SECRET,
      now: NOW,
    });

    const verified = verifyServiceJwt({
      token,
      secret: SECRET,
      expectedAud: SERVICE_IDS.WORKSPACE,
      requiredScopes: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      allowedIssuers: [SERVICE_IDS.TASK],
      now: NOW,
    });

    expect(verified).toEqual({
      iss: SERVICE_IDS.TASK,
      aud: SERVICE_IDS.WORKSPACE,
      scope: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      iat: NOW,
      exp: NOW + DEFAULT_SERVICE_JWT_TTL_SECONDS,
    });
  });

  it('rejects wrong audience', () => {
    const token = signServiceJwt({
      iss: SERVICE_IDS.TASK,
      aud: SERVICE_IDS.WORKSPACE,
      scope: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      secret: SECRET,
      now: NOW,
    });

    expect(() =>
      verifyServiceJwt({
        token,
        secret: SECRET,
        expectedAud: SERVICE_IDS.USER,
        requiredScopes: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
        allowedIssuers: [SERVICE_IDS.TASK],
        now: NOW,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'INTERNAL_ACCESS_DENIED',
      }),
    );
  });

  it('rejects disallowed issuer', () => {
    const token = signServiceJwt({
      iss: SERVICE_IDS.NOTIFICATION,
      aud: SERVICE_IDS.USER,
      scope: [SERVICE_SCOPES.USER_REPLICAS_READ],
      secret: SECRET,
      now: NOW,
    });

    expect(() =>
      verifyServiceJwt({
        token,
        secret: SECRET,
        expectedAud: SERVICE_IDS.USER,
        requiredScopes: [SERVICE_SCOPES.USER_REPLICAS_READ],
        allowedIssuers: [SERVICE_IDS.TASK],
        now: NOW,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'SERVICE_JWT_ISSUER_DENIED',
      }),
    );
  });

  it('rejects missing scope', () => {
    const token = signServiceJwt({
      iss: SERVICE_IDS.TASK,
      aud: SERVICE_IDS.USER,
      scope: [SERVICE_SCOPES.USER_REPLICAS_READ],
      secret: SECRET,
      now: NOW,
    });

    expect(() =>
      verifyServiceJwt({
        token,
        secret: SECRET,
        expectedAud: SERVICE_IDS.USER,
        requiredScopes: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
        allowedIssuers: [SERVICE_IDS.TASK],
        now: NOW,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'SERVICE_JWT_SCOPE_DENIED',
      }),
    );
  });

  it('rejects expired token', () => {
    const token = signServiceJwt({
      iss: SERVICE_IDS.TASK,
      aud: SERVICE_IDS.WORKSPACE,
      scope: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      secret: SECRET,
      ttlSeconds: 60,
      now: NOW,
    });

    expect(() =>
      verifyServiceJwt({
        token,
        secret: SECRET,
        expectedAud: SERVICE_IDS.WORKSPACE,
        requiredScopes: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
        allowedIssuers: [SERVICE_IDS.TASK],
        now: NOW + 120,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'INTERNAL_ACCESS_DENIED',
      }),
    );
  });

  it('rejects ttl longer than contract maximum at sign time', () => {
    expect(() =>
      signServiceJwt({
        iss: SERVICE_IDS.TASK,
        aud: SERVICE_IDS.WORKSPACE,
        scope: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
        secret: SECRET,
        ttlSeconds: 301,
      }),
    ).toThrow('ttlSeconds');
  });
});

describe('ServiceAccessDeniedError', () => {
  it('exposes stable code', () => {
    const error = new ServiceAccessDeniedError(
      'SERVICE_JWT_SCOPE_DENIED',
      'scope missing',
    );

    expect(error.code).toBe('SERVICE_JWT_SCOPE_DENIED');
    expect(error.name).toBe('ServiceAccessDeniedError');
  });
});
