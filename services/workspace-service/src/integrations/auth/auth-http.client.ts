import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildOutboundServiceAuthHeaders, SERVICE_IDS } from '@collabspace/shared';

type AuthMeResponse = {
  email?: string;
  userId?: string;
  roles?: string[];
  permissions?: string[];
};

export type AuthAccountLookup = {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
};

@Injectable()
export class AuthHttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly serviceJwtSecret: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('AUTH_SERVICE_URL') ?? 'http://auth-service:3000';
    this.timeoutMs = Number(this.configService.get<string>('AUTH_SERVICE_TIMEOUT_MS') ?? 3000);
    this.serviceJwtSecret = this.configService.get<string>('SERVICE_JWT_SECRET')?.trim();
  }

  async lookupAccountByEmail(email: string): Promise<AuthAccountLookup | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const { headers } = buildOutboundServiceAuthHeaders({
        iss: SERVICE_IDS.WORKSPACE,
        aud: 'auth-service',
        scope: ['auth.accounts.read'],
        serviceJwtSecret: this.serviceJwtSecret,
      });

      const response = await fetch(`${this.baseUrl}/api/v1/auth/internal/account-lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ email: normalized }),
        signal: controller.signal,
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as AuthAccountLookup | null;
      if (!body?.userId) {
        return null;
      }

      return body;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getCurrentUserAccount(authorizationHeader?: string): Promise<AuthAccountLookup> {
    if (!authorizationHeader?.trim()) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: authorizationHeader.trim() },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new UnauthorizedException('Unable to resolve current user account');
      }

      const body = (await response.json()) as AuthMeResponse;
      const email = body.email?.trim().toLowerCase();
      const userId = body.userId?.trim();
      if (!email || !userId) {
        throw new UnauthorizedException('Current user account is unavailable');
      }

      return {
        userId,
        email,
        roles: body.roles ?? [],
        permissions: body.permissions ?? [],
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async getCurrentUserEmail(authorizationHeader?: string): Promise<string> {
    const account = await this.getCurrentUserAccount(authorizationHeader);
    return account.email;
  }
}
