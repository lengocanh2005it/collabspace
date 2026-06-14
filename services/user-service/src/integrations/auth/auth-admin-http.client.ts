import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

export type AuthAdminUser = {
  createdAt: string;
  email: string;
  emailVerified: boolean;
  id: string;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: string[];
};

@Injectable()
export class AuthAdminHttpClient {
  async listUsers(authorization: string): Promise<AuthAdminUser[]> {
    return this.request<AuthAdminUser[]>('/api/v1/auth/admin/users', authorization);
  }

  async deactivateUser(userId: string, authorization: string): Promise<void> {
    await this.request(
      `/api/v1/auth/admin/users/${encodeURIComponent(userId)}/active-status`,
      authorization,
      {
        body: JSON.stringify({ isActive: false }),
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      },
    );
  }

  private async request<T>(
    path: string,
    authorization: string,
    init: RequestInit = {},
  ): Promise<T> {
    const baseUrl = (
      process.env.AUTH_SERVICE_HTTP_URL ?? 'http://auth-service:3000'
    ).replace(/\/+$/, '');
    const timeoutMs = Number(process.env.AUTH_SERVICE_HTTP_TIMEOUT_MS ?? 3000);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          authorization,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new Error(`Auth admin API returned ${response.status}`);
      }
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'AUTH_ADMIN_API_UNAVAILABLE',
        message:
          error instanceof Error
            ? error.message
            : 'Auth admin API request failed',
      });
    }
  }
}
