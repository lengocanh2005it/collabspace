import { AuthUser } from '@/common/types/identity.type';
import { ConfigurationService } from '@/configuration/configuration.service';
import {
  EMAIL_OUTBOX,
  type EmailOutbox,
} from '@/domain/ports/email-outbox.port';
import {
  EmailVerificationOtpPayload,
  OTP_STORE,
  type OtpStore,
} from '@/domain/ports/otp-store.port';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';

export type { EmailVerificationOtpPayload };

export type EmailVerificationOtpDispatchResult = {
  email: string;
  otpExpiresInSeconds: number;
  userId: string;
};

@Injectable()
export class EmailVerificationOtpService {
  constructor(
    private readonly configurationService: ConfigurationService,
    @Inject(EMAIL_OUTBOX)
    private readonly emailOutbox: EmailOutbox,
    @Inject(OTP_STORE)
    private readonly otpStore: OtpStore,
  ) {}

  buildOtpKey(userId: string): string {
    return `email-verification:otp:${userId}`;
  }

  hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  async send(user: AuthUser): Promise<EmailVerificationOtpDispatchResult> {
    const otp = this.generateOtp();
    const otpTtlSeconds =
      this.configurationService.getEmailVerificationConfig().otpTtlSeconds;

    await this.otpStore.assertAvailable();
    await this.otpStore.setJson(
      this.buildOtpKey(user.userId),
      {
        email: user.email,
        otpHash: this.hashOtp(otp),
      } satisfies EmailVerificationOtpPayload,
      otpTtlSeconds,
    );
    await this.emailOutbox.enqueueEmailVerificationOtp({
      email: user.email,
      otp,
      otpTtlSeconds,
      userId: user.userId,
    });

    return {
      email: user.email,
      otpExpiresInSeconds: otpTtlSeconds,
      userId: user.userId,
    };
  }

  async assertResendAllowed(userId: string): Promise<void> {
    const emailVerificationConfig =
      this.configurationService.getEmailVerificationConfig();
    const cooldownKey = `email-verification:resend:cooldown:${userId}`;
    const attemptsKey = `email-verification:resend:attempts:${userId}`;

    if (await this.otpStore.exists(cooldownKey)) {
      const ttl = await this.otpStore.ttl(cooldownKey);
      throw new HttpException(
        {
          code: 'EMAIL_VERIFICATION_RESEND_COOLDOWN',
          message: `Please wait ${Math.max(ttl, 1)} seconds before resending OTP`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const attempts = await this.otpStore.increment(attemptsKey);

    if (attempts === 1) {
      await this.otpStore.expire(
        attemptsKey,
        emailVerificationConfig.resendWindowSeconds,
      );
    }

    if (attempts > emailVerificationConfig.resendMaxAttempts) {
      const ttl = await this.otpStore.ttl(attemptsKey);
      throw new HttpException(
        {
          code: 'EMAIL_VERIFICATION_RESEND_LIMIT_REACHED',
          message: `OTP resend limit reached. Try again in ${Math.max(ttl, 1)} seconds`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.otpStore.set(
      cooldownKey,
      '1',
      emailVerificationConfig.resendCooldownSeconds,
    );
  }

  private generateOtp(): string {
    const { otpLength } =
      this.configurationService.getEmailVerificationConfig();
    const max = 10 ** otpLength;
    const otp = randomInt(0, max);

    return otp.toString().padStart(otpLength, '0');
  }
}
