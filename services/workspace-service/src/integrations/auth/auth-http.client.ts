import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type AuthMeResponse = {
  email?: string;
};

@Injectable()
export class AuthHttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('AUTH_SERVICE_URL') ?? 'http://auth-service:3000';
    this.timeoutMs = Number(this.configService.get<string>('AUTH_SERVICE_TIMEOUT_MS') ?? 3000);
  }

  async getCurrentUserEmail(authorizationHeader?: string): Promise<string> {
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
        throw new UnauthorizedException('Unable to resolve current user email');
      }

      const body = (await response.json()) as AuthMeResponse;
      const email = body.email?.trim().toLowerCase();
      if (!email) {
        throw new UnauthorizedException('Current user email is unavailable');
      }

      return email;
    } finally {
      clearTimeout(timeout);
    }
  }
}
