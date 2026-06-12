import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMqModule } from '../messaging/rabbitmq.module';
import { WorkspaceOutboxEventEntity } from './entities/workspace-outbox-event.entity';
import { WorkspaceOutboxProcessor } from './workspace-outbox.processor';
import { WorkspaceOutboxService } from './workspace-outbox.service';

@Module({
  imports: [
    RabbitMqModule,
    TypeOrmModule.forFeature([WorkspaceOutboxEventEntity]),
  ],
  providers: [WorkspaceOutboxService, WorkspaceOutboxProcessor],
  exports: [WorkspaceOutboxService],
})
export class OutboxModule {}
