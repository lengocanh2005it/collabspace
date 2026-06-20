import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getWorkspaceOutboxConfig } from './workspace-outbox.config';
import { WorkspaceOutboxService } from './workspace-outbox.service';

@Injectable()
export class WorkspaceOutboxProcessor implements OnModuleInit {
  private readonly logger = new Logger(WorkspaceOutboxProcessor.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly workspaceOutboxService: WorkspaceOutboxService,
  ) {}

  onModuleInit(): void {
    const { enabled } = getWorkspaceOutboxConfig();
    if (!enabled) {
      this.logger.log('Workspace outbox processor is disabled.');
      return;
    }

    this.logger.log('Workspace outbox uses Debezium CDC → Kafka (no RMQ processor).');
    void this.bootstrapOutboxProcessing();
  }

  async bootstrapOutboxProcessing(): Promise<void> {
    if (!this.dataSource.isInitialized) {
      return;
    }

    const released = await this.workspaceOutboxService.releaseInFlightClaimsOnStartup();
    if (released > 0) {
      this.logger.warn(`Released ${released} in-flight workspace outbox event(s) on startup`);
    }
  }
}
