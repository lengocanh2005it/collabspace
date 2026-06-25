import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { Kafka, type Consumer } from "kafkajs";
import { CreateUserReplicaCommand } from "../../../application/commands/create-user-replica.command";
import { SyncUserReplicaCommand } from "../../../application/commands/sync-user-replica.command";
import { processKafkaConsumerMessage, startKafkaConsumerWithRetry } from "@collabspace/shared";
import { ConfigurationService } from "../../../configuration/configuration.service";
import { MetricsService } from "../../../metrics/metrics.service";
import {
  parseKafkaOutboxJsonValue,
  toUserProfileUpdatedEventPayload,
  toUserRegisteredEventPayload,
} from "./kafka-outbox-message";
import { KafkaDlqPublisher } from "./kafka-dlq.publisher";

@Injectable()
export class UserEventsKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserEventsKafkaConsumer.name);
  private consumer: Consumer | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly commandBus: CommandBus,
    private readonly metricsService: MetricsService,
    private readonly kafkaDlqPublisher: KafkaDlqPublisher,
  ) {}

  async onModuleInit(): Promise<void> {
    const kafkaConfig = this.configurationService.getKafkaConfig();
    if (!kafkaConfig.enabled) {
      this.logger.log("Kafka consumers disabled (KAFKA_CONSUMERS_ENABLED=false).");
      return;
    }

    const kafka = new Kafka({
      clientId: kafkaConfig.clientId,
      brokers: kafkaConfig.brokers,
    });

    const consumerGroup = `${kafkaConfig.groupId}-user-events`;
    const topics = [kafkaConfig.userProfileUpdatedTopic, kafkaConfig.userRegisteredTopic];
    const consumer = kafka.consumer({ groupId: consumerGroup });
    this.consumer = consumer;

    void startKafkaConsumerWithRetry({
      description: `Kafka consumer topics=${topics.join(",")} group=${consumerGroup}`,
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
              publishToDlq: (envelope) => this.kafkaDlqPublisher.publish(envelope),
              log: this.logger,
              parseValue: parseKafkaOutboxJsonValue,
              handler: async (record, messageTopic) => {
                if (messageTopic === kafkaConfig.userRegisteredTopic) {
                  await this.handleUserRegistered(record);
                  return;
                }

                if (messageTopic === kafkaConfig.userProfileUpdatedTopic) {
                  await this.handleUserProfileUpdated(record);
                  return;
                }

                this.logger.warn(`Skipping Kafka message from unhandled topic=${messageTopic}`);
              },
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

  private async handleUserRegistered(record: Record<string, unknown>): Promise<void> {
    const payload = toUserRegisteredEventPayload(record);
    if (!payload) {
      this.logger.warn(
        `Skipping Kafka user_registered message missing userId keys=${Object.keys(record).join(",")}`,
      );
      return;
    }

    await this.commandBus.execute(
      new CreateUserReplicaCommand(
        payload.userId,
        payload.fullName,
        payload.email,
        payload.username,
        payload.displayName,
        payload.avatarUrl,
      ),
    );
    this.recordSyncLag(payload.occurredAt);
    this.logger.log(`user_registered via kafka userId=${payload.userId}`);
  }

  private async handleUserProfileUpdated(record: Record<string, unknown>): Promise<void> {
    const payload = toUserProfileUpdatedEventPayload(record);
    if (!payload) {
      this.logger.warn(
        `Skipping Kafka user_profile_updated message missing userId keys=${Object.keys(record).join(",")}`,
      );
      return;
    }

    await this.commandBus.execute(
      new SyncUserReplicaCommand(
        payload.userId,
        payload.fullName || "",
        payload.displayName || undefined,
        payload.avatarUrl || undefined,
        payload.username || undefined,
        payload.email,
        payload.isActive,
      ),
    );
    this.recordSyncLag(payload.occurredAt);
    this.logger.log(`user_profile_updated via kafka userId=${payload.userId}`);
  }

  private recordSyncLag(occurredAt?: string): void {
    if (!occurredAt) {
      return;
    }

    const eventTime = new Date(occurredAt).getTime();

    if (Number.isNaN(eventTime)) {
      return;
    }

    const lagSeconds = Math.max(0, (Date.now() - eventTime) / 1000);
    this.metricsService.recordReplicaSyncLag(lagSeconds, "event");
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.consumer) {
      return;
    }

    try {
      await this.consumer.stop();
      await this.runPromise?.catch(() => undefined);
      await this.consumer.disconnect();
    } catch (error) {
      this.logger.warn(
        `Kafka consumer shutdown error: ${error instanceof Error ? error.message : "unknown"}`,
      );
    } finally {
      this.consumer = null;
      this.runPromise = null;
    }
  }
}
