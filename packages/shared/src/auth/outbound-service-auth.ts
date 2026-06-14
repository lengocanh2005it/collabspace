import { signServiceJwt } from './service-jwt';

export type BuildOutboundServiceAuthHeadersInput = {
  iss: string;
  aud: string;
  scope: string[];
  serviceJwtSecret?: string;
};

export type OutboundServiceAuthHeadersResult = {
  headers: Record<string, string>;
};

/**
 * Builds outbound S2S auth headers with a short-lived Service JWT.
 */
export function buildOutboundServiceAuthHeaders(
  input: BuildOutboundServiceAuthHeadersInput,
): OutboundServiceAuthHeadersResult {
  const serviceJwtSecret = input.serviceJwtSecret?.trim();

  if (!serviceJwtSecret) {
    return { headers: {} };
  }

  const token = signServiceJwt({
    iss: input.iss,
    aud: input.aud,
    scope: input.scope,
    secret: serviceJwtSecret,
  });

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export function isOutboundServiceAuthConfigured(input: {
  serviceJwtSecret?: string;
  nodeEnv?: string;
}): boolean {
  if (input.serviceJwtSecret?.trim()) {
    return true;
  }

  return input.nodeEnv === 'development';
}
