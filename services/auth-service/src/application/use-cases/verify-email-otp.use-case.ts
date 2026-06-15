import type { VerifyEmailOtpRequestDto } from '@/application/dto/auth-request.dto';
import type { VerifyEmailOtpResult } from '@/application/dto/auth-use-case-results';
import {
  type EmailVerificationOtpPayload,
  OTP_STORE,
  type OtpStore,
} from '@/domain/ports/otp-store.port';
import { USER_REPOSITORY, type UserRepository } from '@/domain/repositories/user.repository';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { EmailVerificationOtpService } from '../services/email-verification-otp.service';

@Injectable()
export class VerifyEmailOtpUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(OTP_STORE)
    private readonly otpStore: OtpStore,
    private readonly emailVerificationOtpService: EmailVerificationOtpService,
  ) {}

  async execute(input: VerifyEmailOtpRequestDto): Promise<VerifyEmailOtpResult> {
    const otp = input.otp?.trim();

    if (!input.userId || input.userId.trim().length === 0 || !otp) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_INVALID',
        message: 'User id and OTP are required',
      });
    }

    const existingUser = await this.userRepository.getAuthUserById(input.userId);

    if (existingUser.emailVerified) {
      return {
        email: existingUser.email,
        emailVerified: true,
        verified: true,
      };
    }

    const otpPayload = await this.otpStore.getJson<EmailVerificationOtpPayload>(
      this.emailVerificationOtpService.buildOtpKey(input.userId),
    );

    if (!otpPayload) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_OTP_EXPIRED',
        message: 'Email verification code has expired',
      });
    }

    if (otpPayload.otpHash !== this.emailVerificationOtpService.hashOtp(otp)) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_OTP_INVALID',
        message: 'Email verification code is invalid',
      });
    }

    const user = await this.userRepository.markEmailVerified(input.userId);
    await this.otpStore.delete(this.emailVerificationOtpService.buildOtpKey(input.userId));

    return {
      email: user.email,
      emailVerified: true,
      verified: true,
    };
  }
}
