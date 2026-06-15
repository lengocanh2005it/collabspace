import { ConfigurationModule } from '@/configuration/configuration.module';
import { ConfigurationService } from '@/configuration/configuration.service';
import {
  CreatePendingProfileInput,
  UserProfileClient,
  UserProfileSnapshot,
} from '@/domain/ports/user-profile-client.port';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import type { ClientGrpc } from '@nestjs/microservices';
import { TimeoutError, firstValueFrom, Observable, timeout } from 'rxjs';

export const USER_PROFILES_GRPC_CLIENT = 'USER_PROFILES_GRPC_CLIENT';

type CreatePendingProfileRequest = {
  fullName: string;
  userId: string;
};

type CreatePendingProfileResponse = {
  success: boolean;
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
export class UserProfilesGrpcService
  implements OnModuleInit, UserProfileClient
{
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
    this.userProfilesClient =
      this.client.getClientByServiceName<ReadyGrpcClient>(
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

      const conflict = this.asGrpcConflictException(error);
      if (conflict) {
        throw conflict;
      }

      const message =
        error instanceof Error
          ? error.message
          : `User service gRPC request failed via ${grpcUrl}`;
      this.logger.warn(
        `UserProfilesService.CreatePendingProfile failed: ${message}`,
      );
      throw new ServiceUnavailableException({
        code: 'USER_SERVICE_GRPC_REQUEST_FAILED',
        message,
      });
    }
  }

  async getProfile(input: { userId: string }): Promise<UserProfileSnapshot> {
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

  private asGrpcConflictException(error: unknown): ConflictException | null {
    const grpcCode = this.getGrpcStatusCode(error);
    const message = this.getGrpcErrorMessage(error);
    const payload = this.parseGrpcConflictPayload(message);

    if (grpcCode === status.ALREADY_EXISTS || payload !== null) {
      return new ConflictException({
        code: payload?.code ?? 'USER_ALREADY_EXISTS',
        message: payload?.message ?? 'User already exists',
      });
    }

    if (
      message.includes('duplicate key') &&
      (message.includes('UQ_users_email') || message.includes('users_email'))
    ) {
      return new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: 'User already exists',
      });
    }

    return null;
  }

  private getGrpcStatusCode(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return undefined;
    }

    const code = (error as { code?: unknown }).code;
    return typeof code === 'number' ? code : undefined;
  }

  private getGrpcErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }

    return String(error);
  }

  private parseGrpcConflictPayload(
    message: string,
  ): { code?: string; message?: string } | null {
    const jsonStart = message.indexOf('{');
    if (jsonStart === -1) {
      return null;
    }

    try {
      const parsed = JSON.parse(message.slice(jsonStart)) as {
        code?: unknown;
        message?: unknown;
      };

      if (
        typeof parsed.code !== 'string' &&
        typeof parsed.message !== 'string'
      ) {
        return null;
      }

      return {
        code: typeof parsed.code === 'string' ? parsed.code : undefined,
        message:
          typeof parsed.message === 'string' ? parsed.message : undefined,
      };
    } catch {
      return null;
    }
  }
}
