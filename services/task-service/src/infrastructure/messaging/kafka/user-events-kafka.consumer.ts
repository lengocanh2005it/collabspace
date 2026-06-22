import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { Kafka, type Consumer } from "kafkajs";
import { processKafkaConsumerMessage } from "@collabspace/shared";
import { CreateUserReplicaCommand } from "../../../application/commands/create-user-replica.command";
import { SyncUserReplicaCommand } from "../../../application/commands/sync-user-replica.command";
import { ConfigurationService } from "../../../configuration/configuration.service";
import { MetricsService } from "../../../metrics/metrics.service";
import {
  parseKafkaOutboxJsonValue,
  toUserProfileUpdatedEventPayload,
  toUserRegisteredEventPayload,
} from "./kafka-outbox-message";
import { KafkaDlqPublisher } from "./kafka-dlq.publisher";
import {
  PROCESSED_KAFKA_EVENT_REPOSITORY_TOKEN,
  type IProcessedKafkaEventRepository,
} from "./processed-event.repository";

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
    @Inject(PROCESSED_KAFKA_EVENT_REPOSITORY_TOKEN)
    private readonly processedEventRepository: IProcessedKafkaEventRepository,
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

    this.consumer = kafka.consumer({ groupId: consumerGroup });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [kafkaConfig.userProfileUpdatedTopic, kafkaConfig.userRegisteredTopic],
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
    });

    this.logger.log(
      `Kafka consumer listening topics=${kafkaConfig.userProfileUpdatedTopic},${kafkaConfig.userRegisteredTopic} group=${consumerGroup}`,
    );
  }

  private async handleUserRegistered(record: Record<string, unknown>): Promise<void> {
    const payload = toUserRegisteredEventPayload(record);
    if (!payload) {
      this.logger.warn(
        `Skipping Kafka user_registered message missing userId keys=${Object.keys(record).join(",")}`,
      );
      return;
    }

    if (payload.eventId) {
      const claimed = await this.processedEventRepository.tryClaim(payload.eventId);
      if (!claimed) {
        this.logger.log(
          `user_registered already processed eventId=${payload.eventId} userId=${payload.userId}`,
        );
        return;
      }
    }

    try {
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
    } catch (error) {
      if (payload.eventId) {
        await this.processedEventRepository.releaseClaim(payload.eventId);
      }
      throw error;
    }

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

    if (payload.eventId) {
      const claimed = await this.processedEventRepository.tryClaim(payload.eventId);
      if (!claimed) {
        this.logger.log(
          `user_profile_updated already processed eventId=${payload.eventId} userId=${payload.userId}`,
        );
        return;
      }
    }

    try {
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
    } catch (error) {
      if (payload.eventId) {
        await this.processedEventRepository.releaseClaim(payload.eventId);
      }
      throw error;
    }

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
