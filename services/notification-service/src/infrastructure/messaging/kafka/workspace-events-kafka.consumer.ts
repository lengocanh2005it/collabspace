import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Kafka, type Consumer } from "kafkajs";
import { processKafkaConsumerMessage } from "@collabspace/shared";
import { ConfigurationService } from "../../../configuration/configuration.service";
import { WorkspaceInviteNotificationService } from "../../../application/services/workspace-invite-notification.service";
import { WorkspaceDeletedNotificationService } from "../../../application/services/workspace-deleted-notification.service";
import {
  parseKafkaOutboxJsonValue,
  toWorkspaceDeletedEventPayload,
  toWorkspaceInvitedEventPayload,
} from "./kafka-outbox-message";
import { KafkaDlqPublisher } from "./kafka-dlq.publisher";

@Injectable()
export class WorkspaceEventsKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkspaceEventsKafkaConsumer.name);
  private consumer: Consumer | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly workspaceInviteNotification: WorkspaceInviteNotificationService,
    private readonly workspaceDeletedNotification: WorkspaceDeletedNotificationService,
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

    const consumerGroup = `${kafkaConfig.groupId}-workspace-events`;

    this.consumer = kafka.consumer({ groupId: consumerGroup });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [kafkaConfig.workspaceInvitedTopic, kafkaConfig.workspaceDeletedTopic],
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
            if (messageTopic === kafkaConfig.workspaceInvitedTopic) {
              await this.handleWorkspaceInvited(record);
              return;
            }

            if (messageTopic === kafkaConfig.workspaceDeletedTopic) {
              await this.handleWorkspaceDeleted(record);
              return;
            }

            this.logger.warn(`Skipping Kafka message from unhandled topic=${messageTopic}`);
          },
        });
      },
    });

    this.logger.log(
      `Kafka consumer listening topics=${kafkaConfig.workspaceInvitedTopic},${kafkaConfig.workspaceDeletedTopic} group=${consumerGroup}`,
    );
  }

  private async handleWorkspaceInvited(record: Record<string, unknown>): Promise<void> {
    const payload = toWorkspaceInvitedEventPayload(record);
    if (!payload) {
      this.logger.warn(
        `Skipping Kafka workspace_invited message missing workspaceId/invitedById keys=${Object.keys(record).join(",")}`,
      );
      return;
    }

    await this.workspaceInviteNotification.processWorkspaceInvited(payload, "kafka");
  }

  private async handleWorkspaceDeleted(record: Record<string, unknown>): Promise<void> {
    const payload = toWorkspaceDeletedEventPayload(record);
    if (!payload) {
      this.logger.warn(
        `Skipping Kafka workspace_deleted message missing workspaceId/deletedById keys=${Object.keys(record).join(",")}`,
      );
      return;
    }

    await this.workspaceDeletedNotification.processWorkspaceDeleted(payload, "kafka");
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
