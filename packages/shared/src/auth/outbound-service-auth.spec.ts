import { SERVICE_IDS, SERVICE_SCOPES } from './service-jwt.constants';
import {
  buildOutboundServiceAuthHeaders,
  isOutboundServiceAuthConfigured,
} from './outbound-service-auth';

const SECRET = 'outbound-auth-test-secret';

describe('buildOutboundServiceAuthHeaders', () => {
  it('builds Authorization Bearer header when SERVICE_JWT_SECRET is set', () => {
    const result = buildOutboundServiceAuthHeaders({
      iss: SERVICE_IDS.TASK,
      aud: SERVICE_IDS.WORKSPACE,
      scope: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      serviceJwtSecret: SECRET,
    });

    expect(result.headers.Authorization).toMatch(/^Bearer /);
  });

  it('returns empty headers when SERVICE_JWT_SECRET is missing', () => {
    expect(
      buildOutboundServiceAuthHeaders({
        iss: SERVICE_IDS.TASK,
        aud: SERVICE_IDS.WORKSPACE,
        scope: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      }),
    ).toEqual({ headers: {} });
  });
});

describe('isOutboundServiceAuthConfigured', () => {
  it('is true when service JWT secret is set', () => {
    expect(
      isOutboundServiceAuthConfigured({
        serviceJwtSecret: SECRET,
        nodeEnv: 'production',
      }),
    ).toBe(true);
  });

  it('is true in development without secrets', () => {
    expect(isOutboundServiceAuthConfigured({ nodeEnv: 'development' })).toBe(true);
  });

  it('is false in production without JWT secret', () => {
    expect(isOutboundServiceAuthConfigured({ nodeEnv: 'production' })).toBe(false);
  });
});
