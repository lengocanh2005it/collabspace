import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Kafka, type Consumer } from 'kafkajs';
import {
  TaskCreatedEventSchema,
  TaskDeletedEventSchema,
  TaskStatusChangedEventSchema,
  processKafkaConsumerMessage,
  startKafkaConsumerWithRetry,
} from '@collabspace/shared';
import { ConfigurationService } from '../config/configuration.service.js';
import { AnalyticsRepository } from '../analytics/repositories/analytics.repository.js';
import { KafkaDlqPublisher } from './kafka-dlq.publisher.js';
import { parseKafkaJsonValue, today } from './kafka-message.parser.js';

@Injectable()
export class TaskEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskEventsConsumer.name);
  private consumer: Consumer | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly repository: AnalyticsRepository,
    private readonly dlqPublisher: KafkaDlqPublisher,
  ) {}

  async onModuleInit(): Promise<void> {
    const kafkaConfig = this.configurationService.getKafkaConfig();
    if (!kafkaConfig.enabled) {
      this.logger.log('Kafka consumers disabled (KAFKA_CONSUMERS_ENABLED=false).');
      return;
    }

    const kafka = new Kafka({ clientId: kafkaConfig.clientId, brokers: kafkaConfig.brokers });
    const consumerGroup = `${kafkaConfig.groupId}-task-events`;

    const topics = [
      kafkaConfig.taskCreatedTopic,
      kafkaConfig.taskStatusChangedTopic,
      kafkaConfig.taskDeletedTopic,
    ];
    const consumer = kafka.consumer({ groupId: consumerGroup });
    this.consumer = consumer;

    void startKafkaConsumerWithRetry({
      description: `Kafka consumer topics=${topics.join(',')} group=${consumerGroup}`,
      connect: () => consumer.connect(),
      subscribe: () => consumer.subscribe({ topics, fromBeginning: false }),
      run: () =>
        consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            await processKafkaConsumerMessage({
              context: {
                topic,
                partition,
                offset: message.offset,
                key: message.key,
                value: message.value,
              },
              consumerGroup,
              maxRetries: kafkaConfig.maxRetries,
              retryDelayMs: kafkaConfig.retryDelayMs,
              publishToDlq: (envelope) => this.dlqPublisher.publish(envelope),
              log: this.logger,
              parseValue: parseKafkaJsonValue,
              handler: (record, topic) => this.handleTaskEvent(record, topic),
            });
          },
        }),
      disconnect: () => consumer.disconnect(),
      onStarted: (runPromise) => {
        this.runPromise = runPromise;
      },
      log: this.logger,
      maxRetries: Math.max(kafkaConfig.maxRetries, 12),
      retryDelayMs: Math.max(kafkaConfig.retryDelayMs, 1000),
    });
  }

  async handleTaskEvent(
    record: Record<string, unknown>,
    topic = 'collabspace.task.task_created',
  ): Promise<void> {
    const kafkaConfig = this.configurationService.getKafkaConfig();
    const type = this.resolveEventType(topic, kafkaConfig);

    switch (type) {
      case 'task_created':
        await this.handleTaskCreated(record, topic);
        break;

      case 'task_status_changed':
        await this.handleTaskStatusChanged(record, topic);
        break;

      case 'task_deleted':
        await this.handleTaskDeleted(record, topic);
        break;

      default:
        this.logger.warn(`Skipping unknown task event type=${type ?? 'undefined'}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.consumer) return;

    try {
      await this.consumer.stop();
      await this.runPromise?.catch(() => undefined);
      await this.consumer.disconnect();
    } catch (error) {
      this.logger.warn(
        `Kafka consumer shutdown error: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    } finally {
      this.consumer = null;
      this.runPromise = null;
    }
  }

  private async handleTaskCreated(record: Record<string, unknown>, topic: string): Promise<void> {
    const payload = TaskCreatedEventSchema.safeParse(record);
    if (!payload.success) {
      this.logger.warn(
        `Skipping invalid task_created analytics event keys=${Object.keys(record).join(',')}`,
      );
      return;
    }

    const processed = await this.repository.processEventOnce(
      payload.data.eventId,
      'task_created',
      topic,
      async () => {
        await this.repository.incrementSnapshot('tasks.total', 1);
        await this.repository.incrementSnapshot(`tasks.byStatus.${payload.data.status}`, 1);
        await this.repository.incrementTimeseries(
          this.getEventDate(payload.data.occurredAt),
          'tasks_created',
          1,
        );
      },
    );
    if (processed) this.logger.log(`Processed task_created event ${payload.data.taskId}`);
  }

  private async handleTaskStatusChanged(
    record: Record<string, unknown>,
    topic: string,
  ): Promise<void> {
    const payload = TaskStatusChangedEventSchema.safeParse(record);
    if (!payload.success) {
      this.logger.warn(
        `Skipping invalid task_status_changed analytics event keys=${Object.keys(record).join(',')}`,
      );
      return;
    }

    const processed = await this.repository.processEventOnce(
      payload.data.eventId,
      'task_status_changed',
      topic,
      async () => {
        await this.repository.decrementSnapshot(`tasks.byStatus.${payload.data.previousStatus}`, 1);
        await this.repository.incrementSnapshot(`tasks.byStatus.${payload.data.newStatus}`, 1);
        if (payload.data.newStatus === 'DONE') {
          await this.repository.incrementTimeseries(
            this.getEventDate(payload.data.occurredAt),
            'tasks_completed',
            1,
          );
        }
      },
    );
    if (processed) {
      this.logger.log(
        `Processed task_status_changed event ${payload.data.previousStatus} → ${payload.data.newStatus}`,
      );
    }
  }

  private async handleTaskDeleted(record: Record<string, unknown>, topic: string): Promise<void> {
    const payload = TaskDeletedEventSchema.safeParse(record);
    if (!payload.success) {
      this.logger.warn(
        `Skipping invalid task_deleted analytics event keys=${Object.keys(record).join(',')}`,
      );
      return;
    }

    const processed = await this.repository.processEventOnce(
      payload.data.eventId,
      'task_deleted',
      topic,
      async () => {
        await this.repository.decrementSnapshot('tasks.total', 1);
        await this.repository.decrementSnapshot(`tasks.byStatus.${payload.data.status}`, 1);
      },
    );
    if (processed) this.logger.log(`Processed task_deleted event ${payload.data.taskId}`);
  }

  private resolveEventType(
    topic: string,
    kafkaConfig: ReturnType<ConfigurationService['getKafkaConfig']>,
  ) {
    if (topic === kafkaConfig.taskCreatedTopic) return 'task_created';
    if (topic === kafkaConfig.taskStatusChangedTopic) return 'task_status_changed';
    if (topic === kafkaConfig.taskDeletedTopic) return 'task_deleted';
    return typeof topic === 'string' && topic.length > 0 ? topic.split('.').at(-1) : undefined;
  }

  private getEventDate(occurredAt?: string): string {
    if (!occurredAt) return today();
    const timestamp = Date.parse(occurredAt);
    if (Number.isNaN(timestamp)) return today();
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}
