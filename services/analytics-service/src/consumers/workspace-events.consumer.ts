import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Kafka, type Consumer } from 'kafkajs';
import { processKafkaConsumerMessage } from '@collabspace/shared';
import { ConfigurationService } from '../config/configuration.service.js';
import { AnalyticsRepository } from '../analytics/repositories/analytics.repository.js';
import { KafkaDlqPublisher } from './kafka-dlq.publisher.js';
import { parseKafkaJsonValue, today } from './kafka-message.parser.js';

@Injectable()
export class WorkspaceEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkspaceEventsConsumer.name);
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
    const consumerGroup = `${kafkaConfig.groupId}-workspace-events`;

    this.consumer = kafka.consumer({ groupId: consumerGroup });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [kafkaConfig.workspaceEventsTopic],
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
          handler: (record) => this.handleWorkspaceEvent(record),
        });
      },
    });

    this.logger.log(
      `Kafka consumer listening topic=${kafkaConfig.workspaceEventsTopic} group=${consumerGroup}`,
    );
  }

  async handleWorkspaceEvent(record: Record<string, unknown>): Promise<void> {
    const type = record['type'] as string | undefined;

    switch (type) {
      case 'workspace_created':
        await this.repository.incrementSnapshot('workspaces.total', 1);
        await this.repository.incrementTimeseries(today(), 'workspaces_created', 1);
        this.logger.log('Processed workspace_created event');
        break;

      case 'project_created':
        await this.repository.incrementSnapshot('projects.total', 1);
        this.logger.log('Processed project_created event');
        break;

      case 'member_joined':
        await this.repository.incrementSnapshot('workspaces.totalMembers', 1);
        this.logger.log('Processed member_joined event');
        break;

      case 'member_left':
        await this.repository.decrementSnapshot('workspaces.totalMembers', 1);
        this.logger.log('Processed member_left event');
        break;

      default:
        this.logger.warn(`Skipping unknown workspace event type=${type ?? 'undefined'}`);
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
