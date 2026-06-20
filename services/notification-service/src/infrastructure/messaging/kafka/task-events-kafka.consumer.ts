import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { Kafka, type Consumer } from "kafkajs";
import { InboundNotificationEventMapper } from "../../../application/mappers/inbound-notification-event.mapper";
import { ConfigurationService } from "../../../configuration/configuration.service";
import {
  parseKafkaOutboxJsonValue,
  toCommentMentionedEventPayload,
  toTaskAssignedEventPayload,
  toTaskCommentedEventPayload,
} from "./kafka-outbox-message";
import {
  resolveCommandTimeoutMs,
  withCommandTimeout,
} from "../../../presentation/helpers/notification-command.helper";

@Injectable()
export class TaskEventsKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskEventsKafkaConsumer.name);
  private consumer: Consumer | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly commandBus: CommandBus,
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

    this.consumer = kafka.consumer({ groupId: `${kafkaConfig.groupId}-task-events` });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [
        kafkaConfig.taskAssignedTopic,
        kafkaConfig.taskCommentCreatedTopic,
        kafkaConfig.taskCommentMentionedTopic,
      ],
      fromBeginning: false,
    });

    this.runPromise = this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const record = parseKafkaOutboxJsonValue(message.value);
        if (!record) {
          this.logger.warn(`Skipping Kafka ${topic} message with empty or invalid JSON`);
          return;
        }

        try {
          if (topic === kafkaConfig.taskAssignedTopic) {
            await this.handleTaskAssigned(record);
            return;
          }

          if (topic === kafkaConfig.taskCommentCreatedTopic) {
            await this.handleTaskCommented(record);
            return;
          }

          if (topic === kafkaConfig.taskCommentMentionedTopic) {
            await this.handleCommentMentioned(record);
            return;
          }

          this.logger.warn(`Skipping Kafka message from unhandled topic=${topic}`);
        } catch (error) {
          this.logger.error(
            `Failed to process Kafka message topic=${topic}`,
            error instanceof Error ? error.stack : undefined,
          );
          throw error;
        }
      },
    });

    this.logger.log(
      `Kafka consumer listening topics=${kafkaConfig.taskAssignedTopic},${kafkaConfig.taskCommentCreatedTopic},${kafkaConfig.taskCommentMentionedTopic} group=${kafkaConfig.groupId}-task-events`,
    );
  }

  private async handleTaskAssigned(record: Record<string, unknown>): Promise<void> {
    const payload = toTaskAssignedEventPayload(record);
    if (!payload) {
      this.logger.warn(
        `Skipping Kafka task_assigned message missing taskId/recipientId keys=${Object.keys(record).join(",")}`,
      );
      return;
    }

    await this.executeCommand(
      InboundNotificationEventMapper.toTaskAssignedCommand(payload),
      "task_assigned",
    );
  }

  private async handleTaskCommented(record: Record<string, unknown>): Promise<void> {
    const payload = toTaskCommentedEventPayload(record);
    if (!payload) {
      this.logger.warn(
        `Skipping Kafka comment_created message missing taskId/commentId/recipientId keys=${Object.keys(record).join(",")}`,
      );
      return;
    }

    await this.executeCommand(
      InboundNotificationEventMapper.toTaskCommentedCommand(payload),
      "task_commented",
    );
  }

  private async handleCommentMentioned(record: Record<string, unknown>): Promise<void> {
    const payload = toCommentMentionedEventPayload(record);
    if (!payload) {
      this.logger.warn(
        `Skipping Kafka comment_mentioned message missing taskId/commentId/recipientId keys=${Object.keys(record).join(",")}`,
      );
      return;
    }

    await this.executeCommand(
      InboundNotificationEventMapper.toCommentMentionedCommand(payload),
      "comment_mentioned",
    );
  }

  private async executeCommand(
    command: ReturnType<typeof InboundNotificationEventMapper.toTaskAssignedCommand>,
    eventLabel: string,
  ): Promise<void> {
    await withCommandTimeout(this.commandBus.execute(command), resolveCommandTimeoutMs());
    this.logger.log(`Processed ${eventLabel} via kafka recipientId=${command.recipientId}`);
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
