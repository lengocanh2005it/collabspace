import { ConfigurationService } from '@/configuration/configuration.service';
import {
  Inject,
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

export const USER_PROFILES_GRPC_CLIENT = 'USER_PROFILES_GRPC_CLIENT';

type CreatePendingProfileInput = {
  fullName: string;
  userId: string;
};

type CreatePendingProfileRequest = {
  fullName: string;
  userId: string;
};

type CreatePendingProfileResponse = {
  success: boolean;
  userId: string;
};

type GetProfileInput = {
  userId: string;
};

type GetProfileRequest = {
  userId: string;
};

type GetProfileResponse = {
  fullName?: string;
  userId: string;
};

type UserProfilesGrpcClient = {
  createPendingProfile(
    request: CreatePendingProfileRequest,
  ): Observable<CreatePendingProfileResponse>;
  getProfile(request: GetProfileRequest): Observable<GetProfileResponse>;
};

@Injectable()
export class UserProfilesGrpcService implements OnModuleInit {
  private readonly client: ClientGrpc;
  private userProfilesService?: UserProfilesGrpcClient;

  constructor(
    private readonly configurationService: ConfigurationService,
    @Inject(USER_PROFILES_GRPC_CLIENT)
    client: unknown,
  ) {
    this.client = client as ClientGrpc;
  }

  onModuleInit(): void {
    this.userProfilesService = this.client.getService<UserProfilesGrpcClient>(
      'UserProfilesService',
    );
  }

  async createPendingProfile(input: CreatePendingProfileInput): Promise<void> {
    if (!this.userProfilesService) {
      throw new ServiceUnavailableException({
        code: 'USER_SERVICE_GRPC_UNAVAILABLE',
        message: 'User profiles gRPC client is not initialized',
      });
    }

    try {
      await firstValueFrom(
        this.userProfilesService.createPendingProfile(input),
      );
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'USER_SERVICE_GRPC_REQUEST_FAILED',
        message:
          error instanceof Error
            ? error.message
            : `User service gRPC request failed via ${this.configurationService.getUserServiceConfig().grpcUrl}`,
      });
    }
  }

  async getProfile(input: GetProfileInput): Promise<GetProfileResponse> {
    if (!this.userProfilesService) {
      throw new ServiceUnavailableException({
        code: 'USER_SERVICE_GRPC_UNAVAILABLE',
        message: 'User profiles gRPC client is not initialized',
      });
    }

    try {
      return await firstValueFrom(this.userProfilesService.getProfile(input));
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'USER_SERVICE_GRPC_REQUEST_FAILED',
        message:
          error instanceof Error
            ? error.message
            : `User service gRPC request failed via ${this.configurationService.getUserServiceConfig().grpcUrl}`,
      });
    }
  }
}
