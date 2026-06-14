import {
  SERVICE_IDS,
  SERVICE_SCOPES,
} from './service-jwt.constants';
import { ServiceAccessDeniedError } from './service-jwt.errors';
import { signServiceJwt } from './service-jwt';
import { assertServiceToServiceAccess } from './service-to-service-access';

const SECRET = 'phase-1-test-service-jwt-secret';
const INTERNAL_TOKEN = 'legacy-internal-token';

describe('assertServiceToServiceAccess', () => {
  it('accepts a valid service JWT', () => {
    const token = signServiceJwt({
      iss: SERVICE_IDS.TASK,
      aud: SERVICE_IDS.WORKSPACE,
      scope: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      secret: SECRET,
    });

    const result = assertServiceToServiceAccess({
      headers: {
        authorization: `Bearer ${token}`,
      },
      expectedAud: SERVICE_IDS.WORKSPACE,
      requiredScopes: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      allowedIssuers: [SERVICE_IDS.TASK],
      serviceJwtSecret: SECRET,
      internalServiceToken: INTERNAL_TOKEN,
    });

    expect(result.method).toBe('service-jwt');
    expect(result.verifiedJwt?.iss).toBe(SERVICE_IDS.TASK);
  });

  it('falls back to X-Internal-Service-Token when Bearer is absent', () => {
    const result = assertServiceToServiceAccess({
      headers: {
        'x-internal-service-token': INTERNAL_TOKEN,
      },
      expectedAud: SERVICE_IDS.WORKSPACE,
      requiredScopes: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      allowedIssuers: [SERVICE_IDS.TASK],
      serviceJwtSecret: SECRET,
      internalServiceToken: INTERNAL_TOKEN,
    });

    expect(result.method).toBe('internal-token');
  });

  it('allows development bypass when no secrets are configured', () => {
    const result = assertServiceToServiceAccess({
      headers: {},
      expectedAud: SERVICE_IDS.WORKSPACE,
      requiredScopes: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      allowedIssuers: [SERVICE_IDS.TASK],
      nodeEnv: 'development',
    });

    expect(result.method).toBe('development-bypass');
  });

  it('rejects missing credentials when fallback is disabled', () => {
    expect(() =>
      assertServiceToServiceAccess({
        headers: {},
        expectedAud: SERVICE_IDS.WORKSPACE,
        requiredScopes: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
        allowedIssuers: [SERVICE_IDS.TASK],
        serviceJwtSecret: SECRET,
        internalServiceToken: INTERNAL_TOKEN,
        internalServiceTokenFallbackEnabled: false,
        nodeEnv: 'production',
      }),
    ).toThrow(ServiceAccessDeniedError);
  });

  it('rejects invalid legacy token', () => {
    expect(() =>
      assertServiceToServiceAccess({
        headers: {
          'x-internal-service-token': 'wrong-token',
        },
        expectedAud: SERVICE_IDS.USER,
        requiredScopes: [SERVICE_SCOPES.USER_REPLICAS_READ],
        allowedIssuers: [SERVICE_IDS.TASK, SERVICE_IDS.NOTIFICATION],
        internalServiceToken: INTERNAL_TOKEN,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'INTERNAL_ACCESS_DENIED',
      }),
    );
  });
});
