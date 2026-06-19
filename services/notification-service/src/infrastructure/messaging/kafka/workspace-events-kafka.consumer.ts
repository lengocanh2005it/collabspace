import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Kafka, type Consumer } from "kafkajs";
import { ConfigurationService } from "../../../configuration/configuration.service";
import { WorkspaceInviteNotificationService } from "../../../application/services/workspace-invite-notification.service";
import { WorkspaceDeletedNotificationService } from "../../../application/services/workspace-deleted-notification.service";
import {
  parseKafkaOutboxJsonValue,
  toWorkspaceDeletedEventPayload,
  toWorkspaceInvitedEventPayload,
} from "./kafka-outbox-message";

@Injectable()
export class WorkspaceEventsKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkspaceEventsKafkaConsumer.name);
  private consumer: Consumer | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly workspaceInviteNotification: WorkspaceInviteNotificationService,
    private readonly workspaceDeletedNotification: WorkspaceDeletedNotificationService,
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

    this.consumer = kafka.consumer({ groupId: kafkaConfig.groupId });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [kafkaConfig.workspaceInvitedTopic, kafkaConfig.workspaceDeletedTopic],
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
          if (topic === kafkaConfig.workspaceInvitedTopic) {
            await this.handleWorkspaceInvited(record);
            return;
          }

          if (topic === kafkaConfig.workspaceDeletedTopic) {
            await this.handleWorkspaceDeleted(record);
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
      `Kafka consumer listening topics=${kafkaConfig.workspaceInvitedTopic},${kafkaConfig.workspaceDeletedTopic} group=${kafkaConfig.groupId}`,
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
