import { ConfigurationService } from '@/configuration/configuration.service';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { TimeoutError, firstValueFrom, Observable, timeout } from 'rxjs';

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
  username?: string;
};

type UserProfilesGrpcClient = {
  createPendingProfile(
    request: CreatePendingProfileRequest,
  ): Observable<CreatePendingProfileResponse>;
  getProfile(request: GetProfileRequest): Observable<GetProfileResponse>;
};

type ReadyGrpcClient = {
  waitForReady(
    deadline: number,
    callback: (error?: Error | null) => void,
  ): void;
};

@Injectable()
export class UserProfilesGrpcService implements OnModuleInit {
  private readonly logger = new Logger(UserProfilesGrpcService.name);
  private readonly client: ClientGrpc;
  private userProfilesClient?: ReadyGrpcClient;
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
    this.userProfilesClient = this.client.getClientByServiceName<ReadyGrpcClient>(
      'UserProfilesService',
    );
  }

  async ping(): Promise<void> {
    if (!this.userProfilesClient) {
      throw new ServiceUnavailableException({
        code: 'USER_SERVICE_GRPC_UNAVAILABLE',
        message: 'User profiles gRPC client is not initialized',
      });
    }

    const { grpcTimeoutMs, grpcUrl } =
      this.configurationService.getUserServiceConfig();

    try {
      await new Promise<void>((resolve, reject) => {
        this.userProfilesClient?.waitForReady(
          Date.now() + grpcTimeoutMs,
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          },
        );
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('deadline')
      ) {
        throw new ServiceUnavailableException({
          code: 'USER_SERVICE_GRPC_TIMEOUT',
          message: `User service gRPC readiness timed out after ${grpcTimeoutMs}ms via ${grpcUrl}`,
        });
      }

      throw new ServiceUnavailableException({
        code: 'USER_SERVICE_GRPC_REQUEST_FAILED',
        message:
          error instanceof Error
            ? error.message
            : `User service gRPC readiness check failed via ${grpcUrl}`,
      });
    }
  }

  async createPendingProfile(input: CreatePendingProfileInput): Promise<void> {
    if (!this.userProfilesService) {
      throw new ServiceUnavailableException({
        code: 'USER_SERVICE_GRPC_UNAVAILABLE',
        message: 'User profiles gRPC client is not initialized',
      });
    }

    const { grpcTimeoutMs, grpcUrl } =
      this.configurationService.getUserServiceConfig();

    try {
      await firstValueFrom(
        this.userProfilesService
          .createPendingProfile(input)
          .pipe(timeout({ first: grpcTimeoutMs })),
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.logger.warn(
          `UserProfilesService.CreatePendingProfile timed out after ${grpcTimeoutMs}ms via ${grpcUrl}`,
        );
        throw new ServiceUnavailableException({
          code: 'USER_SERVICE_GRPC_TIMEOUT',
          message: `User service gRPC request timed out after ${grpcTimeoutMs}ms via ${grpcUrl}`,
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : `User service gRPC request failed via ${grpcUrl}`;
      this.logger.warn(`UserProfilesService.CreatePendingProfile failed: ${message}`);
      throw new ServiceUnavailableException({
        code: 'USER_SERVICE_GRPC_REQUEST_FAILED',
        message,
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

    const { grpcTimeoutMs, grpcUrl } =
      this.configurationService.getUserServiceConfig();

    try {
      return await firstValueFrom(
        this.userProfilesService
          .getProfile(input)
          .pipe(timeout({ first: grpcTimeoutMs })),
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.logger.warn(
          `UserProfilesService.GetProfile timed out after ${grpcTimeoutMs}ms via ${grpcUrl}`,
        );
        throw new ServiceUnavailableException({
          code: 'USER_SERVICE_GRPC_TIMEOUT',
          message: `User service gRPC request timed out after ${grpcTimeoutMs}ms via ${grpcUrl}`,
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : `User service gRPC request failed via ${grpcUrl}`;
      this.logger.warn(`UserProfilesService.GetProfile failed: ${message}`);
      throw new ServiceUnavailableException({
        code: 'USER_SERVICE_GRPC_REQUEST_FAILED',
        message,
      });
    }
  }
}
