import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CreatePendingUserProfileUseCase } from '../../application/use-cases/create-pending-user-profile.use-case';

type CreatePendingProfileRequest = {
  fullName: string;
  userId: string;
};

type CreatePendingProfileResponse = {
  success: boolean;
  userId: string;
};

@Controller()
export class UserProfilesGrpcController {
  constructor(
    private readonly createPendingUserProfileUseCase: CreatePendingUserProfileUseCase,
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
}
