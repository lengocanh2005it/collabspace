import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigurationService } from '@/configuration/configuration.service';
import { EmailsService } from '@/modules/emails/emails.service';
import { AuthOutboxService } from './auth-outbox.service';
import {
  AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP,
  AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL,
} from './entities/auth-outbox-event.entity';

@Injectable()
export class AuthOutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthOutboxProcessor.name);
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly authOutboxService: AuthOutboxService,
    private readonly configurationService: ConfigurationService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly emailsService: EmailsService,
  ) {}

  onModuleInit(): void {
    if (!this.configurationService.getOutboxConfig().enabled) {
      this.logger.log('Auth outbox processor is disabled. Skipping startup.');
      return;
    }

    const pollIntervalMs = this.configurationService.getOutboxConfig().pollIntervalMs;
    this.timer = setInterval(() => {
      void this.processPendingEvents();
    }, pollIntervalMs);
    this.timer.unref();
    void this.processPendingEvents();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processPendingEvents(): Promise<void> {
    if (this.isProcessing || !this.dataSource.isInitialized) {
      return;
    }

    this.isProcessing = true;

    try {
      const reclaimedCount = await this.authOutboxService.reclaimStaleClaims();

      if (reclaimedCount > 0) {
        this.logger.warn(
          `Reclaimed ${reclaimedCount} stale auth outbox event(s) for retry`,
        );
      }

      const events = await this.authOutboxService.claimPendingBatch();

      for (const event of events) {
        try {
          await this.publishEvent(event.eventType, event.payload);
          await this.authOutboxService.markProcessed(event.id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown outbox processing error';
          this.logger.warn(
            `Auth outbox publish failed for ${event.id} (${event.eventType}): ${message}`,
          );
          try {
            await this.authOutboxService.markFailed(
              event.id,
              event.attemptCount,
              message,
            );
          } catch (markFailedError) {
            const markFailedMessage =
              markFailedError instanceof Error
                ? markFailedError.message
                : 'Unknown markFailed error';
            this.logger.error(
              `Auth outbox markFailed error for ${event.id}: ${markFailedMessage}`,
            );
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async publishEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    switch (eventType) {
      case AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP:
        await this.emailsService.sendMailNow({
          subject: 'Verify your CollabSpace email',
          text: [
            `Your CollabSpace verification code is ${String(payload.otp)}.`,
            `This code expires in ${Number(payload.otpTtlSeconds)} seconds.`,
          ].join(' '),
          to: String(payload.email),
        });
        return;
      case AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL:
        await this.emailsService.sendMailNow({
          subject: 'Reset your CollabSpace password',
          text: [
            `Use this password reset token: ${String(payload.token)}.`,
            `It expires in ${Number(payload.ttlSeconds)} seconds.`,
          ].join(' '),
          to: String(payload.email),
        });
        return;
      default:
        throw new Error(`Unsupported auth outbox event type: ${eventType}`);
    }
  }
}
