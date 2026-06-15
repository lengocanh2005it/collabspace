import { ConflictException, Controller, HttpException, NotFoundException } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { CreatePendingUserProfileUseCase } from '../../application/use-cases/create-pending-user-profile.use-case';
import { GetUserProfileUseCase } from '../../application/use-cases/get-user-profile.use-case';
import { BulkGetUserProfilesUseCase } from '../../application/use-cases/bulk-get-user-profiles.use-case';

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
  fullName: string;
  userId: string;
  username?: string;
};

type GetProfilesRequest = {
  userIds: string[];
};

type GetProfilesResponse = {
  profiles: Array<{
    avatarUrl?: string;
    fullName: string;
    userId: string;
  }>;
};

@Controller()
export class UserProfilesGrpcController {
  constructor(
    private readonly createPendingUserProfileUseCase: CreatePendingUserProfileUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
    private readonly bulkGetUserProfilesUseCase: BulkGetUserProfilesUseCase,
  ) {}

  @GrpcMethod('UserProfilesService', 'CreatePendingProfile')
  async createPendingProfile(
    request: CreatePendingProfileRequest,
  ): Promise<CreatePendingProfileResponse> {
    try {
      const profile = await this.createPendingUserProfileUseCase.execute(request);
      return { success: true, userId: profile.userId };
    } catch (error) {
      throw this.mapRpcError(error, 'CreatePendingProfile failed');
    }
  }

  @GrpcMethod('UserProfilesService', 'GetProfile')
  async getProfile(request: GetProfileRequest): Promise<GetProfileResponse> {
    try {
      const profile = await this.getUserProfileUseCase.execute(request.userId);
      return {
        fullName: profile.fullName,
        userId: profile.userId,
        username: profile.username ?? undefined,
      };
    } catch (error) {
      throw this.mapRpcError(error, 'GetProfile failed');
    }
  }

  @GrpcMethod('UserProfilesService', 'GetProfiles')
  async getProfiles(request: GetProfilesRequest): Promise<GetProfilesResponse> {
    try {
      const profiles = await this.bulkGetUserProfilesUseCase.execute(request.userIds ?? []);
      return {
        profiles: profiles.map((profile) => ({
          avatarUrl: profile.avatarUrl ?? undefined,
          fullName: profile.fullName,
          userId: profile.userId,
        })),
      };
    } catch (error) {
      throw this.mapRpcError(error, 'GetProfiles failed');
    }
  }

  private mapRpcError(error: unknown, fallbackMessage: string): RpcException {
    if (error instanceof ConflictException) {
      const response = error.getResponse();
      const details =
        typeof response === 'object' && response !== null ? response : { message: error.message };

      return new RpcException({
        code: status.ALREADY_EXISTS,
        ...details,
      });
    }

    if (error instanceof NotFoundException) {
      const response = error.getResponse();
      const details =
        typeof response === 'object' && response !== null ? response : { message: error.message };

      return new RpcException({
        code: status.NOT_FOUND,
        ...details,
      });
    }

    if (error instanceof HttpException) {
      const response = error.getResponse();
      const details =
        typeof response === 'object' && response !== null ? response : { message: error.message };

      return new RpcException({
        code: status.INTERNAL,
        ...details,
      });
    }

    return new RpcException({
      code: status.INTERNAL,
      message: error instanceof Error ? error.message : fallbackMessage,
    });
  }
}
