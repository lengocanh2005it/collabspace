import type {
  EmailOutbox,
  EmailOutboxStats,
  EmailVerificationOtpEnqueuePayload,
  PasswordResetEmailEnqueuePayload,
} from '@/domain/ports/email-outbox.port';
import { AuthOutboxProcessor } from '@/infrastructure/outbox/auth-outbox.processor';
import { AuthOutboxService } from '@/infrastructure/outbox/auth-outbox.service';
import { Inject, Injectable, forwardRef } from '@nestjs/common';

@Injectable()
export class TypeOrmEmailOutboxAdapter implements EmailOutbox {
  constructor(
    private readonly authOutboxService: AuthOutboxService,
    @Inject(forwardRef(() => AuthOutboxProcessor))
    private readonly authOutboxProcessor: AuthOutboxProcessor,
  ) {}

  async enqueueEmailVerificationOtp(payload: EmailVerificationOtpEnqueuePayload): Promise<void> {
    await this.authOutboxService.enqueueEmailVerificationOtp(payload);
    await this.authOutboxProcessor.processPendingEvents();
  }

  async enqueuePasswordResetEmail(payload: PasswordResetEmailEnqueuePayload): Promise<void> {
    await this.authOutboxService.enqueuePasswordResetEmail(payload);
    await this.authOutboxProcessor.processPendingEvents();
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
