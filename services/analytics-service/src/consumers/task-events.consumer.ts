import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Kafka, type Consumer } from 'kafkajs';
import { processKafkaConsumerMessage } from '@collabspace/shared';
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

    this.consumer = kafka.consumer({ groupId: consumerGroup });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [kafkaConfig.taskEventsTopic],
      fromBeginning: false,
    });

    this.runPromise = this.consumer.run({
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
          handler: (record) => this.handleTaskEvent(record),
        });
      },
    });

    this.logger.log(
      `Kafka consumer listening topic=${kafkaConfig.taskEventsTopic} group=${consumerGroup}`,
    );
  }

  async handleTaskEvent(record: Record<string, unknown>): Promise<void> {
    const type = record['type'] as string | undefined;

    switch (type) {
      case 'task_created': {
        const status = (record['status'] as string) ?? 'TODO';
        await this.repository.incrementSnapshot('tasks.total', 1);
        await this.repository.incrementSnapshot(`tasks.byStatus.${status}`, 1);
        await this.repository.incrementTimeseries(today(), 'tasks_created', 1);
        this.logger.log(`Processed task_created event status=${status}`);
        break;
      }

      case 'task_status_changed': {
        const previousStatus = record['previousStatus'] as string | undefined;
        const newStatus = record['newStatus'] as string | undefined;

        if (previousStatus) {
          await this.repository.decrementSnapshot(`tasks.byStatus.${previousStatus}`, 1);
        }
        if (newStatus) {
          await this.repository.incrementSnapshot(`tasks.byStatus.${newStatus}`, 1);
          if (newStatus === 'DONE') {
            await this.repository.incrementTimeseries(today(), 'tasks_completed', 1);
          }
        }
        this.logger.log(
          `Processed task_status_changed event ${previousStatus ?? '?'} → ${newStatus ?? '?'}`,
        );
        break;
      }

      case 'task_deleted': {
        const status = (record['status'] as string) ?? 'TODO';
        await this.repository.decrementSnapshot('tasks.total', 1);
        await this.repository.decrementSnapshot(`tasks.byStatus.${status}`, 1);
        this.logger.log(`Processed task_deleted event status=${status}`);
        break;
      }

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
}
