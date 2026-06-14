import {
  SERVICE_IDS,
  SERVICE_SCOPES,
} from './service-jwt.constants';
import { ServiceAccessDeniedError } from './service-jwt.errors';
import { signServiceJwt } from './service-jwt';
import { assertServiceToServiceAccess } from './service-to-service-access';

const SECRET = 'phase-1-test-service-jwt-secret';

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
    });

    expect(result.method).toBe('service-jwt');
    expect(result.verifiedJwt?.iss).toBe(SERVICE_IDS.TASK);
  });

  it('allows development bypass when SERVICE_JWT_SECRET is not configured', () => {
    const result = assertServiceToServiceAccess({
      headers: {},
      expectedAud: SERVICE_IDS.WORKSPACE,
      requiredScopes: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      allowedIssuers: [SERVICE_IDS.TASK],
      nodeEnv: 'development',
    });

    expect(result.method).toBe('development-bypass');
  });

  it('rejects missing credentials outside development', () => {
    expect(() =>
      assertServiceToServiceAccess({
        headers: {},
        expectedAud: SERVICE_IDS.WORKSPACE,
        requiredScopes: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
        allowedIssuers: [SERVICE_IDS.TASK],
        serviceJwtSecret: SECRET,
        nodeEnv: 'production',
      }),
    ).toThrow(ServiceAccessDeniedError);
  });

  it('rejects legacy X-Internal-Service-Token header', () => {
    expect(() =>
      assertServiceToServiceAccess({
        headers: {
          'x-internal-service-token': 'legacy-internal-token',
        },
        expectedAud: SERVICE_IDS.USER,
        requiredScopes: [SERVICE_SCOPES.USER_REPLICAS_READ],
        allowedIssuers: [SERVICE_IDS.TASK, SERVICE_IDS.NOTIFICATION],
        serviceJwtSecret: SECRET,
      }),
    ).toThrow(ServiceAccessDeniedError);
  });
});
