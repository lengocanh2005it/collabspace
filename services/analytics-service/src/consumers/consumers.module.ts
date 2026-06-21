import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AuthEventsConsumer } from './auth-events.consumer.js';
import { WorkspaceEventsConsumer } from './workspace-events.consumer.js';
import { TaskEventsConsumer } from './task-events.consumer.js';
import { KafkaDlqPublisher } from './kafka-dlq.publisher.js';

@Module({
  imports: [AnalyticsModule],
  providers: [KafkaDlqPublisher, AuthEventsConsumer, WorkspaceEventsConsumer, TaskEventsConsumer],
})
export class ConsumersModule {}
