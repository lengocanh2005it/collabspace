import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Kafka, type Consumer } from "kafkajs";
import { processKafkaConsumerMessage } from "@collabspace/shared";
import { ConfigurationService } from "../../../configuration/configuration.service";
import { WorkspaceDeletionService } from "../../../application/services/workspace-deletion.service";
import { parseKafkaOutboxJsonValue, toWorkspaceDeletedEventPayload } from "./kafka-outbox-message";
import { KafkaDlqPublisher } from "./kafka-dlq.publisher";

@Injectable()
export class WorkspaceDeletedKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkspaceDeletedKafkaConsumer.name);
  private consumer: Consumer | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly deletionService: WorkspaceDeletionService,
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
    const workspaceDeletedTopic = kafkaConfig.workspaceDeletedTopic;

    this.consumer = kafka.consumer({ groupId: consumerGroup });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: workspaceDeletedTopic,
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
          handler: async (record) => {
            const payload = toWorkspaceDeletedEventPayload(record);
            if (!payload) {
              this.logger.warn(
                `Skipping Kafka workspace_deleted message missing workspaceId/deletedById keys=${Object.keys(record).join(",")}`,
              );
              return;
            }

            const deletedTasks = await this.deletionService.deleteWorkspaceData(
              payload.workspaceId,
            );
            this.logger.warn(
              `workspace_deleted via kafka workspaceId=${payload.workspaceId} deletedTasks=${deletedTasks}`,
            );
          },
        });
      },
    });

    this.logger.log(
      `Kafka consumer listening topic=${workspaceDeletedTopic} group=${consumerGroup}`,
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
