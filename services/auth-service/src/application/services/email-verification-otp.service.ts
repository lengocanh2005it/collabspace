import { AuthUser } from '@/common/types/identity.type';
import { ConfigurationService } from '@/configuration/configuration.service';
import { AuthOutboxService } from '@/modules/outbox/auth-outbox.service';
import { RedisService } from '@/modules/redis/redis.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';

export type EmailVerificationOtpPayload = {
  email: string;
  otpHash: string;
};

export type EmailVerificationOtpDispatchResult = {
  email: string;
  otpExpiresInSeconds: number;
  userId: string;
};

@Injectable()
export class EmailVerificationOtpService {
  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly authOutboxService: AuthOutboxService,
    private readonly redisService: RedisService,
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

    await this.redisService.assertAvailable();
    await this.redisService.setJson(
      this.buildOtpKey(user.userId),
      {
        email: user.email,
        otpHash: this.hashOtp(otp),
      } satisfies EmailVerificationOtpPayload,
      otpTtlSeconds,
    );
    await this.authOutboxService.enqueueEmailVerificationOtp({
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

    if (await this.redisService.exists(cooldownKey)) {
      const ttl = await this.redisService.ttl(cooldownKey);
      throw new HttpException(
        {
          code: 'EMAIL_VERIFICATION_RESEND_COOLDOWN',
          message: `Please wait ${Math.max(ttl, 1)} seconds before resending OTP`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const attempts = await this.redisService.increment(attemptsKey);

    if (attempts === 1) {
      await this.redisService.expire(
        attemptsKey,
        emailVerificationConfig.resendWindowSeconds,
      );
    }

    if (attempts > emailVerificationConfig.resendMaxAttempts) {
      const ttl = await this.redisService.ttl(attemptsKey);
      throw new HttpException(
        {
          code: 'EMAIL_VERIFICATION_RESEND_LIMIT_REACHED',
          message: `OTP resend limit reached. Try again in ${Math.max(ttl, 1)} seconds`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.redisService.set(
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
