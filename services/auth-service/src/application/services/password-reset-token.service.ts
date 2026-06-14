import type { AuthUser } from '@/domain/entities/auth-user';
import { ConfigurationService } from '@/configuration/configuration.service';
import {
  EMAIL_OUTBOX,
  type EmailOutbox,
} from '@/domain/ports/email-outbox.port';
import { OTP_STORE, type OtpStore } from '@/domain/ports/otp-store.port';
import type { PasswordResetTokenPayload } from '@/domain/types/password-reset-token';
import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

export type PasswordResetDispatchResult = {
  email: string;
  tokenTtlSeconds: number;
  userId: string;
};

@Injectable()
export class PasswordResetTokenService {
  constructor(
    private readonly configurationService: ConfigurationService,
    @Inject(EMAIL_OUTBOX)
    private readonly emailOutbox: EmailOutbox,
    @Inject(OTP_STORE)
    private readonly otpStore: OtpStore,
  ) {}

  buildLookupKey(token: string): string {
    return `password-reset:lookup:${this.hashToken(token)}`;
  }

  buildUserKey(userId: string): string {
    return `password-reset:user:${userId}`;
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async send(user: AuthUser): Promise<PasswordResetDispatchResult> {
    const token = this.generateToken();
    const tokenTtlSeconds =
      this.configurationService.getPasswordResetConfig().ttlSeconds;

    await this.otpStore.assertAvailable();

    const existingUserPayload = await this.otpStore.getJson<{
      tokenHash: string;
    }>(this.buildUserKey(user.userId));

    if (existingUserPayload?.tokenHash) {
      await this.otpStore.delete(
        this.buildLookupKeyFromHash(existingUserPayload.tokenHash),
      );
    }

    await this.otpStore.setJson(
      this.buildLookupKey(token),
      {
        email: user.email,
        userId: user.userId,
      } satisfies PasswordResetTokenPayload,
      tokenTtlSeconds,
    );
    await this.otpStore.setJson(
      this.buildUserKey(user.userId),
      { tokenHash: this.hashToken(token) },
      tokenTtlSeconds,
    );
    await this.emailOutbox.enqueuePasswordResetEmail({
      email: user.email,
      token,
      ttlSeconds: tokenTtlSeconds,
      userId: user.userId,
    });

    return {
      email: user.email,
      tokenTtlSeconds,
      userId: user.userId,
    };
  }

  async consumeToken(token: string): Promise<PasswordResetTokenPayload | null> {
    const normalizedToken = token?.trim();
    if (!normalizedToken) {
      return null;
    }

    const lookupKey = this.buildLookupKey(normalizedToken);
    const payload = await this.otpStore.getJson<PasswordResetTokenPayload>(
      lookupKey,
    );

    if (!payload) {
      return null;
    }

    await this.otpStore.delete([
      lookupKey,
      this.buildUserKey(payload.userId),
    ]);

    return payload;
  }

  private buildLookupKeyFromHash(tokenHash: string): string {
    return `password-reset:lookup:${tokenHash}`;
  }

  private generateToken(): string {
    const byteLength =
      this.configurationService.getPasswordResetConfig().tokenByteLength;

    return randomBytes(byteLength).toString('base64url');
  }
}
