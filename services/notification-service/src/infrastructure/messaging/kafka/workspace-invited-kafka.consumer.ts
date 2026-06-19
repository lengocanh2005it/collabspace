import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Kafka, type Consumer } from "kafkajs";
import { ConfigurationService } from "../../../configuration/configuration.service";
import { WorkspaceInviteNotificationService } from "../../../application/services/workspace-invite-notification.service";
import { parseKafkaOutboxJsonValue, toWorkspaceInvitedEventPayload } from "./kafka-outbox-message";

@Injectable()
export class WorkspaceInvitedKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkspaceInvitedKafkaConsumer.name);
  private consumer: Consumer | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly workspaceInviteNotification: WorkspaceInviteNotificationService,
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
      topic: kafkaConfig.workspaceInvitedTopic,
      fromBeginning: false,
    });

    this.runPromise = this.consumer.run({
      eachMessage: async ({ message }) => {
        const record = parseKafkaOutboxJsonValue(message.value);
        if (!record) {
          this.logger.warn("Skipping Kafka workspace_invited message with empty or invalid JSON");
          return;
        }

        const payload = toWorkspaceInvitedEventPayload(record);
        if (!payload) {
          this.logger.warn(
            `Skipping Kafka workspace_invited message missing workspaceId/invitedById keys=${Object.keys(record).join(",")}`,
          );
          return;
        }

        try {
          await this.workspaceInviteNotification.processWorkspaceInvited(payload, "kafka");
        } catch (error) {
          this.logger.error(
            "Failed to process workspace_invited Kafka message",
            error instanceof Error ? error.stack : undefined,
          );
          throw error;
        }
      },
    });

    this.logger.log(
      `Kafka consumer listening topic=${kafkaConfig.workspaceInvitedTopic} group=${kafkaConfig.groupId}`,
    );
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
