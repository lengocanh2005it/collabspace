import {
  AuthUser,
  RegisterInput,
  RegisterPendingResult,
} from '@/common/types/identity.type';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { UserProfilesGrpcService } from '@/modules/identity/user-profiles-grpc.service';
import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { EmailVerificationOtpService } from '../services/email-verification-otp.service';

@Injectable()
export class RegisterUseCase {
  private readonly logger = new Logger(RegisterUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly userProfilesGrpcService: UserProfilesGrpcService,
    private readonly emailVerificationOtpService: EmailVerificationOtpService,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterPendingResult> {
    const { user, newlyCreated } = await this.registerOrRecoverPendingUser(input);

    try {
      await this.userProfilesGrpcService.createPendingProfile({
        fullName: input.fullName,
        userId: user.userId,
      });
      const result = await this.emailVerificationOtpService.send(user);

      return {
        ...result,
        emailVerified: false,
        verificationRequired: true,
      };
    } catch (error) {
      if (newlyCreated) {
        await this.userRepository.rollbackNewRegistration(user.userId);
      }

      throw error;
    }
  }

  private async registerOrRecoverPendingUser(
    input: RegisterInput,
  ): Promise<{ newlyCreated: boolean; user: AuthUser }> {
    try {
      const user = await this.userRepository.register(input);
      return { newlyCreated: true, user };
    } catch (error) {
      if (!this.isUserAlreadyExistsConflict(error)) {
        throw error;
      }

      const existingUser = await this.userRepository.findUserByEmail(input.email);

      if (!existingUser || existingUser.emailVerified || !existingUser.isActive) {
        throw error;
      }

      this.logger.warn(
        `Recovered pending registration for ${existingUser.userId} via duplicate register request`,
      );

      return { newlyCreated: false, user: existingUser };
    }
  }

  private isUserAlreadyExistsConflict(error: unknown): boolean {
    if (!(error instanceof ConflictException)) {
      return false;
    }

    const response = error.getResponse();
    return (
      typeof response === 'object' &&
      response !== null &&
      'code' in response &&
      (response as { code?: unknown }).code === 'USER_ALREADY_EXISTS'
    );
  }
}
