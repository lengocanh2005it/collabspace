import type { ResendEmailVerificationOtpResult } from '@/application/dto/auth-use-case-results';
import { ResendEmailVerificationOtpRequestDto } from '@/application/dto/auth-request.dto';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EmailVerificationOtpService } from '../services/email-verification-otp.service';

@Injectable()
export class ResendEmailVerificationOtpUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly emailVerificationOtpService: EmailVerificationOtpService,
  ) {}

  async execute(
    input: ResendEmailVerificationOtpRequestDto,
  ): Promise<ResendEmailVerificationOtpResult> {
    const email = input.email?.trim().toLowerCase();

    if (!email) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_INVALID',
        message: 'Email is required',
      });
    }

    const user = await this.userRepository.findUserByEmail(email);

    if (!user) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_INVALID',
        message: 'No pending verification found for this email',
      });
    }

    if (user.emailVerified) {
      throw new UnauthorizedException({
        code: 'EMAIL_ALREADY_VERIFIED',
        message: 'Email address has already been verified',
      });
    }

    await this.emailVerificationOtpService.assertResendAllowed(user.userId);
    const result = await this.emailVerificationOtpService.send(user);

    return {
      ...result,
      emailVerified: false,
      resent: true,
    };
  }
}
