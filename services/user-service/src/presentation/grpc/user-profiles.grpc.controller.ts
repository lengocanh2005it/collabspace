import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
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
    const profile = await this.createPendingUserProfileUseCase.execute(request);

    return {
      success: true,
      userId: profile.userId,
    };
  }

  @GrpcMethod('UserProfilesService', 'GetProfile')
  async getProfile(request: GetProfileRequest): Promise<GetProfileResponse> {
    const profile = await this.getUserProfileUseCase.execute(request.userId);

    return {
      fullName: profile.fullName,
      userId: profile.userId,
    };
  }

  @GrpcMethod('UserProfilesService', 'GetProfiles')
  async getProfiles(request: GetProfilesRequest): Promise<GetProfilesResponse> {
    const profiles = await this.bulkGetUserProfilesUseCase.execute(
      request.userIds ?? [],
    );

    return {
      profiles: profiles.map((profile) => ({
        avatarUrl: profile.avatarUrl ?? undefined,
        fullName: profile.fullName,
        userId: profile.userId,
      })),
    };
  }
}
