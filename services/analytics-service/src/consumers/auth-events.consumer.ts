import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Kafka, type Consumer } from 'kafkajs';
import { UserRegisteredEventSchema, processKafkaConsumerMessage } from '@collabspace/shared';
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
    const consumerGroup = `${kafkaConfig.groupId}-user-events`;

    this.consumer = kafka.consumer({ groupId: consumerGroup });
    try {
      await this.consumer.connect();
    } catch (error) {
      this.logger.warn(
        `Kafka consumer failed to connect (non-fatal): ${error instanceof Error ? error.message : String(error)}`,
      );
      this.consumer = null;
      return;
    }
    await this.consumer.subscribe({
      topics: [kafkaConfig.userRegisteredTopic],
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
          handler: (record, topic) => this.handleAuthEvent(record, topic),
        });
      },
    });

    this.logger.log(
      `Kafka consumer listening topic=${kafkaConfig.userRegisteredTopic} group=${consumerGroup}`,
    );
  }

  async handleAuthEvent(
    record: Record<string, unknown>,
    topic = 'collabspace.user.registered',
  ): Promise<void> {
    const payload = UserRegisteredEventSchema.safeParse(record);

    if (!payload.success) {
      this.logger.warn(
        `Skipping invalid user_registered analytics event keys=${Object.keys(record).join(',')}`,
      );
      return;
    }

    const eventId = this.getEventId(record, `user_registered:${payload.data.userId}`);

    const processed = await this.repository.processEventOnce(
      eventId,
      'user_registered',
      topic,
      async () => {
        await this.repository.incrementSnapshot('users.total', 1);
        await this.repository.incrementSnapshot('users.active', 1);
        await this.repository.incrementTimeseries(
          this.getEventDate(payload.data.occurredAt),
          'users_registered',
          1,
        );
      },
    );

    if (processed) {
      this.logger.log(`Processed user_registered event userId=${payload.data.userId}`);
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

  private getEventId(record: Record<string, unknown>, fallback: string): string {
    return typeof record.eventId === 'string' && record.eventId.length > 0
      ? record.eventId
      : fallback;
  }

  private getEventDate(occurredAt?: string): string {
    if (!occurredAt) return today();
    const timestamp = Date.parse(occurredAt);
    if (Number.isNaN(timestamp)) return today();
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}
