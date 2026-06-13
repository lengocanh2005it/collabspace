import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { runOutboxPollCycle } from '@collabspace/shared';
import { ConfigurationService } from '@/configuration/configuration.service';
import { EmailsService } from '@/infrastructure/emails/emails.service';
import { AuthOutboxService } from './auth-outbox.service';
import { AuthOutboxPublishRegistry } from './auth-outbox-publish.registry';

@Injectable()
export class AuthOutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthOutboxProcessor.name);
  private readonly publishRegistry: AuthOutboxPublishRegistry;
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly authOutboxService: AuthOutboxService,
    private readonly configurationService: ConfigurationService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    emailsService: EmailsService,
  ) {
    this.publishRegistry = new AuthOutboxPublishRegistry(emailsService);
  }

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
      await runOutboxPollCycle(
        {
          reclaimStaleClaims: () => this.authOutboxService.reclaimStaleClaims(),
          claimPendingBatch: () => this.authOutboxService.claimPendingBatch(),
          publish: (event) =>
            this.publishRegistry.publish(event.eventType, event.payload),
          markProcessed: (id) => this.authOutboxService.markProcessed(id),
          markFailed: (id, attemptCount, message) =>
            this.authOutboxService.markFailed(id, attemptCount, message),
          logLabel: 'auth outbox',
          safeMarkFailed: true,
        },
        this.logger,
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
