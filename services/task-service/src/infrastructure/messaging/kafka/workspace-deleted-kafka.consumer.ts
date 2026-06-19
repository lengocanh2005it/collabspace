import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Kafka, type Consumer } from "kafkajs";
import { ConfigurationService } from "../../../configuration/configuration.service";
import { WorkspaceDeletionService } from "../../../application/services/workspace-deletion.service";
import { parseKafkaOutboxJsonValue, toWorkspaceDeletedEventPayload } from "./kafka-outbox-message";

@Injectable()
export class WorkspaceDeletedKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkspaceDeletedKafkaConsumer.name);
  private consumer: Consumer | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly deletionService: WorkspaceDeletionService,
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
      topic: kafkaConfig.workspaceDeletedTopic,
      fromBeginning: false,
    });

    this.runPromise = this.consumer.run({
      eachMessage: async ({ message }) => {
        const record = parseKafkaOutboxJsonValue(message.value);
        if (!record) {
          this.logger.warn("Skipping Kafka workspace_deleted message with empty or invalid JSON");
          return;
        }

        const payload = toWorkspaceDeletedEventPayload(record);
        if (!payload) {
          this.logger.warn(
            `Skipping Kafka workspace_deleted message missing workspaceId/deletedById keys=${Object.keys(record).join(",")}`,
          );
          return;
        }

        try {
          const deletedTasks = await this.deletionService.deleteWorkspaceData(payload.workspaceId);
          this.logger.warn(
            `workspace_deleted via kafka workspaceId=${payload.workspaceId} deletedTasks=${deletedTasks}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to clean task data for workspaceId=${payload.workspaceId}`,
            error instanceof Error ? error.stack : undefined,
          );
          throw error;
        }
      },
    });

    this.logger.log(
      `Kafka consumer listening topic=${kafkaConfig.workspaceDeletedTopic} group=${kafkaConfig.groupId}`,
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
