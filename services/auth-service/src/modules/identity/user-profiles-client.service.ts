import { ConfigurationService } from '@/configuration/configuration.service';
import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

type CreatePendingProfileInput = {
  fullName: string;
  userId: string;
};

@Injectable()
export class UserProfilesClientService {
  constructor(
    private readonly configurationService: ConfigurationService,
  ) {}

  async createPendingProfile(input: CreatePendingProfileInput): Promise<void> {
    await this.request('/api/v1/internal/users/profiles', {
      body: JSON.stringify(input),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    });
  }

  private buildUrl(pathname: string): string {
    const baseUrl = this.configurationService.getUserServiceConfig().url;
    return `${baseUrl.replace(/\/$/, '')}${pathname}`;
  }

  private async request(
    pathname: string,
    init: RequestInit,
  ): Promise<void> {
    let response: Response;

    try {
      response = await fetch(this.buildUrl(pathname), init);
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'USER_SERVICE_UNAVAILABLE',
        message:
          error instanceof Error
            ? error.message
            : 'User service request failed',
      });
    }

    if (response.ok) {
      return;
    }

    const responseText = await response.text();
    throw new ServiceUnavailableException({
      code: 'USER_SERVICE_REQUEST_FAILED',
      message:
        responseText || `User service responded with status ${response.status}`,
    });
  }
}
