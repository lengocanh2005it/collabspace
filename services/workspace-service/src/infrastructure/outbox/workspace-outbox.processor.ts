import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type * as amqp from 'amqplib';
import { DatabaseService } from '../database/database.service';
import { WORKSPACE_INVITED_EVENT } from '../../domain/events/workspace-events';
import { getWorkspaceOutboxConfig } from './workspace-outbox.config';
import { WorkspaceOutboxService } from './workspace-outbox.service';
import { WORKSPACE_OUTBOX_EVENT_WORKSPACE_INVITED } from './entities/workspace-outbox-event.entity';

@Injectable()
export class WorkspaceOutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkspaceOutboxProcessor.name);
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly workspaceOutboxService: WorkspaceOutboxService,
    @Inject('RABBITMQ_CHANNEL')
    private readonly rabbitChannel: amqp.Channel,
  ) {}

  onModuleInit(): void {
    const { enabled, pollIntervalMs } = getWorkspaceOutboxConfig();

    if (!enabled) {
      this.logger.log('Workspace outbox processor is disabled.');
      return;
    }

    this.timer = setInterval(() => {
      void this.processPendingEvents();
    }, pollIntervalMs);
    this.timer.unref();
    void this.processPendingEvents();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processPendingEvents(): Promise<void> {
    if (this.isProcessing || !this.databaseService.isInitialized) {
      return;
    }

    this.isProcessing = true;

    try {
      const reclaimed = await this.workspaceOutboxService.reclaimStaleClaims();

      if (reclaimed > 0) {
        this.logger.warn(`Reclaimed ${reclaimed} stale workspace outbox event(s)`);
      }

      const events = await this.workspaceOutboxService.claimPendingBatch();

      for (const event of events) {
        try {
          await this.publishEvent(event.eventType, event.payload);
          await this.workspaceOutboxService.markProcessed(event.id);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown workspace outbox error';
          this.logger.warn(
            `Workspace outbox publish failed for ${event.id}: ${message}`,
          );
          await this.workspaceOutboxService.markFailed(
            event.id,
            event.attemptCount,
            message,
          );
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
    if (eventType !== WORKSPACE_OUTBOX_EVENT_WORKSPACE_INVITED) {
      throw new Error(`Unsupported workspace outbox event type: ${eventType}`);
    }

    const published = this.rabbitChannel.publish(
      'collabspace_exchange',
      WORKSPACE_INVITED_EVENT,
      Buffer.from(JSON.stringify(payload)),
    );

    if (!published) {
      throw new Error('RabbitMQ publish buffer full');
    }
  }
}
