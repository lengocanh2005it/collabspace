import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database/database.module';
import { WorkspaceOutboxEventEntity } from './entities/workspace-outbox-event.entity';
import { WorkspaceOutboxProcessor } from './workspace-outbox.processor';
import { WorkspaceOutboxService } from './workspace-outbox.service';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([WorkspaceOutboxEventEntity]),
  ],
  providers: [WorkspaceOutboxService, WorkspaceOutboxProcessor],
  exports: [WorkspaceOutboxService],
})
export class OutboxModule {}
