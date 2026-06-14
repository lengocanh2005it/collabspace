import {
  EmailOutbox,
  EmailOutboxStats,
  EmailVerificationOtpEnqueuePayload,
  PasswordResetEmailEnqueuePayload,
} from '@/domain/ports/email-outbox.port';
import { AuthOutboxService } from '@/infrastructure/outbox/auth-outbox.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TypeOrmEmailOutboxAdapter implements EmailOutbox {
  constructor(private readonly authOutboxService: AuthOutboxService) {}

  enqueueEmailVerificationOtp(
    payload: EmailVerificationOtpEnqueuePayload,
  ): Promise<void> {
    return this.authOutboxService.enqueueEmailVerificationOtp(payload);
  }

  enqueuePasswordResetEmail(
    payload: PasswordResetEmailEnqueuePayload,
  ): Promise<void> {
    return this.authOutboxService.enqueuePasswordResetEmail(payload);
  }

  getStats(): Promise<EmailOutboxStats> {
    return this.authOutboxService.getStats();
  }

  getDevOtp(email: string): Promise<string | null> {
    return this.authOutboxService.getDevOtp(email);
  }

  getDevPasswordResetToken(email: string): Promise<string | null> {
    return this.authOutboxService.getDevPasswordResetToken(email);
  }
}
