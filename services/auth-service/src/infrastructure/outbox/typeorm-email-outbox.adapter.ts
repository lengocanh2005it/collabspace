import {
  EmailOutbox,
  EmailOutboxStats,
  EmailVerificationOtpEnqueuePayload,
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

  getStats(): Promise<EmailOutboxStats> {
    return this.authOutboxService.getStats();
  }
}
