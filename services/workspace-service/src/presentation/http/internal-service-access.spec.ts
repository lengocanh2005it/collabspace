import { SERVICE_IDS, SERVICE_SCOPES, signServiceJwt } from '@collabspace/shared';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { assertInternalServiceAccess } from './internal-service-access';

describe('assertInternalServiceAccess (workspace-service)', () => {
  const testServiceJwtSecret = 'phase-2-service-jwt-secret';
  const originalEnv = {
    serviceJwtSecret: process.env.SERVICE_JWT_SECRET,
    nodeEnv: process.env.NODE_ENV,
  };

  const request = (headers: Record<string, string>): Request => ({ headers }) as Request;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.SERVICE_JWT_SECRET = testServiceJwtSecret;
  });

  afterEach(() => {
    process.env.SERVICE_JWT_SECRET = originalEnv.serviceJwtSecret;
    process.env.NODE_ENV = originalEnv.nodeEnv;
  });

  it('accepts a valid service JWT from task-service', () => {
    const token = signServiceJwt({
      iss: SERVICE_IDS.TASK,
      aud: SERVICE_IDS.WORKSPACE,
      scope: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      secret: testServiceJwtSecret,
    });

    expect(() =>
      assertInternalServiceAccess(request({ authorization: `Bearer ${token}` })),
    ).not.toThrow();
  });

  it('rejects service JWT from notification-service', () => {
    const token = signServiceJwt({
      iss: SERVICE_IDS.NOTIFICATION,
      aud: SERVICE_IDS.WORKSPACE,
      scope: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      secret: testServiceJwtSecret,
    });

    expect(() =>
      assertInternalServiceAccess(request({ authorization: `Bearer ${token}` })),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'SERVICE_JWT_ISSUER_DENIED',
        }),
      }),
    );
  });

  it('rejects missing credentials outside development', () => {
    expect(() => assertInternalServiceAccess(request({}))).toThrow(UnauthorizedException);
  });
});
