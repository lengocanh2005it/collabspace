import {
  ResendEmailVerificationOtpInput,
  ResendEmailVerificationOtpResult,
} from '@/common/types/identity.type';
import { IdentityService } from '@/modules/identity/identity.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EmailVerificationOtpService } from '../services/email-verification-otp.service';

@Injectable()
export class ResendEmailVerificationOtpUseCase {
  constructor(
    private readonly identityService: IdentityService,
    private readonly emailVerificationOtpService: EmailVerificationOtpService,
  ) {}

  async execute(
    input: ResendEmailVerificationOtpInput,
  ): Promise<ResendEmailVerificationOtpResult> {
    const email = input.email?.trim().toLowerCase();

    if (!email) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_INVALID',
        message: 'Email is required',
      });
    }

    const user = await this.identityService.findUserByEmail(email);

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
