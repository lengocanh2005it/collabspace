import { VerifyEmailOtpRequestDto } from '@/application/dto/auth-request.dto';
import { VerifyEmailOtpResult } from '@/common/types/identity.type';
import { IdentityService } from '@/modules/identity/identity.service';
import { RedisService } from '@/modules/redis/redis.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  EmailVerificationOtpPayload,
  EmailVerificationOtpService,
} from '../services/email-verification-otp.service';

@Injectable()
export class VerifyEmailOtpUseCase {
  constructor(
    private readonly identityService: IdentityService,
    private readonly redisService: RedisService,
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

    const existingUser = await this.identityService.getAuthUserById(input.userId);

    if (existingUser.emailVerified) {
      return {
        email: existingUser.email,
        emailVerified: true,
        verified: true,
      };
    }

    const otpPayload = await this.redisService.getJson<EmailVerificationOtpPayload>(
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

    const user = await this.identityService.markEmailVerified(input.userId);
    await this.redisService.delete(
      this.emailVerificationOtpService.buildOtpKey(input.userId),
    );

    return {
      email: user.email,
      emailVerified: true,
      verified: true,
    };
  }
}
