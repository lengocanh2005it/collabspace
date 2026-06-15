import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { runOutboxPollCycle } from '@collabspace/shared';
import type * as amqp from 'amqplib';
import type { DataSource } from 'typeorm';
import {
  WORKSPACE_DELETED_EVENT,
  WORKSPACE_INVITED_EVENT,
} from '../../domain/events/workspace-events';
import {
  WORKSPACE_OUTBOX_EVENT_WORKSPACE_DELETED,
  WORKSPACE_OUTBOX_EVENT_WORKSPACE_INVITED,
} from './entities/workspace-outbox-event.entity';
import { getWorkspaceOutboxConfig } from './workspace-outbox.config';
import type { WorkspaceOutboxService } from './workspace-outbox.service';

@Injectable()
export class WorkspaceOutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkspaceOutboxProcessor.name);
  private isProcessing = false;
  private pendingWake = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

    this.timer = setInterval(() => void this.processPendingEvents(), pollIntervalMs);
    this.timer.unref();
    void this.bootstrapOutboxProcessing();
  }

  private async bootstrapOutboxProcessing(): Promise<void> {
    const released = await this.workspaceOutboxService.releaseInFlightClaimsOnStartup();
    if (released > 0) {
      this.logger.warn(`Released ${released} in-flight workspace outbox event(s) on startup`);
    }

    await this.processPendingEvents();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processPendingEvents(): Promise<void> {
    if (!this.dataSource.isInitialized) {
      return;
    }

    this.pendingWake = true;
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      while (this.pendingWake) {
        this.pendingWake = false;

        const exhaustedCount = await this.workspaceOutboxService.markExhaustedClaims();
        if (exhaustedCount > 0) {
          this.logger.warn(
            `Marked ${exhaustedCount} exhausted workspace outbox event(s) as failed`,
          );
        }

        await runOutboxPollCycle(
          {
            reclaimStaleClaims: () => this.workspaceOutboxService.reclaimStaleClaims(),
            claimPendingBatch: () => this.workspaceOutboxService.claimPendingBatch(),
            publish: (event) => this.publishEvent(event.eventType, event.payload),
            markProcessed: (id) => this.workspaceOutboxService.markProcessed(id),
            markFailed: (id, attemptCount, message) =>
              this.workspaceOutboxService.markFailed(id, attemptCount, message),
            logLabel: 'workspace outbox',
            safeMarkFailed: true,
          },
          this.logger,
        );
      }
    } catch (error) {
      this.logger.error(
        `Workspace outbox processing failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    } finally {
      this.isProcessing = false;
      if (this.pendingWake) {
        void this.processPendingEvents();
      }
    }
  }

  private async publishEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const routingKey =
      eventType === WORKSPACE_OUTBOX_EVENT_WORKSPACE_INVITED
        ? WORKSPACE_INVITED_EVENT
        : eventType === WORKSPACE_OUTBOX_EVENT_WORKSPACE_DELETED
          ? WORKSPACE_DELETED_EVENT
          : null;

    if (!routingKey) {
      throw new Error(`Unsupported workspace outbox event type: ${eventType}`);
    }

    const published = this.rabbitChannel.publish(
      'collabspace_exchange',
      routingKey,
      Buffer.from(JSON.stringify(payload)),
    );
    if (!published) throw new Error('RabbitMQ publish buffer full');
  }
}
