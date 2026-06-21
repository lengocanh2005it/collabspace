import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Kafka, type Consumer } from 'kafkajs';
import { processKafkaConsumerMessage } from '@collabspace/shared';
import { ConfigurationService } from '../config/configuration.service.js';
import { AnalyticsRepository } from '../analytics/repositories/analytics.repository.js';
import { KafkaDlqPublisher } from './kafka-dlq.publisher.js';
import { parseKafkaJsonValue, today } from './kafka-message.parser.js';

@Injectable()
export class AuthEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthEventsConsumer.name);
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
    const consumerGroup = `${kafkaConfig.groupId}-auth-events`;

    this.consumer = kafka.consumer({ groupId: consumerGroup });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [kafkaConfig.authEventsTopic],
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
          handler: (record) => this.handleAuthEvent(record),
        });
      },
    });

    this.logger.log(
      `Kafka consumer listening topic=${kafkaConfig.authEventsTopic} group=${consumerGroup}`,
    );
  }

  async handleAuthEvent(record: Record<string, unknown>): Promise<void> {
    const type = record['type'] as string | undefined;

    switch (type) {
      case 'user_registered':
        await this.repository.incrementSnapshot('users.total', 1);
        await this.repository.incrementSnapshot('users.active', 1);
        await this.repository.incrementTimeseries(today(), 'users_registered', 1);
        this.logger.log('Processed user_registered event');
        break;

      case 'user_login':
        break;

      default:
        this.logger.warn(`Skipping unknown auth event type=${type ?? 'undefined'}`);
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
