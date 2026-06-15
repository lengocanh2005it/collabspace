import type { EmailsService } from '@/infrastructure/emails/emails.service';
import {
  AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP,
  AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL,
} from '../database/entities/auth-outbox-event.orm-entity';

export type AuthOutboxPublishHandler = (payload: Record<string, unknown>) => Promise<void>;

/**
 * Strategy registry: maps auth outbox event types to publish handlers.
 */
export class AuthOutboxPublishRegistry {
  private readonly handlers = new Map<string, AuthOutboxPublishHandler>();

  constructor(emailsService: EmailsService) {
    this.handlers.set(AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP, async (payload) => {
      await emailsService.sendMailNow({
        subject: 'Verify your CollabSpace email',
        text: [
          `Your CollabSpace verification code is ${String(payload.otp)}.`,
          `This code expires in ${Number(payload.otpTtlSeconds)} seconds.`,
        ].join(' '),
        to: String(payload.email),
      });
    });

    this.handlers.set(AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL, async (payload) => {
      await emailsService.sendMailNow({
        subject: 'Reset your CollabSpace password',
        text: [
          `Use this password reset token: ${String(payload.token)}.`,
          `It expires in ${Number(payload.ttlSeconds)} seconds.`,
        ].join(' '),
        to: String(payload.email),
      });
    });
  }

  async publish(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const handler = this.handlers.get(eventType);
    if (!handler) {
      throw new Error(`Unsupported auth outbox event type: ${eventType}`);
    }
    await handler(payload);
  }
}
