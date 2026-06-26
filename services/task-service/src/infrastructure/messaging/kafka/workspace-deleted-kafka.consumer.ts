import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { Kafka, type Consumer } from "kafkajs";
import { processKafkaConsumerMessage, startKafkaConsumerWithRetry } from "@collabspace/shared";
import { ConfigurationService } from "../../../configuration/configuration.service";
import { WorkspaceDeletionService } from "../../../application/services/workspace-deletion.service";
import { WorkspaceMembershipCacheService } from "../../cache/workspace-membership-cache.service";
import {
  parseKafkaOutboxJsonValue,
  toWorkspaceDeletedEventPayload,
  toWorkspaceMemberLeftEventPayload,
} from "./kafka-outbox-message";
import { KafkaDlqPublisher } from "./kafka-dlq.publisher";
import {
  PROCESSED_KAFKA_EVENT_REPOSITORY_TOKEN,
  type IProcessedKafkaEventRepository,
} from "./processed-event.repository";

@Injectable()
export class WorkspaceDeletedKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkspaceDeletedKafkaConsumer.name);
  private consumer: Consumer | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly deletionService: WorkspaceDeletionService,
    private readonly membershipCache: WorkspaceMembershipCacheService,
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

    const consumerGroup = `${kafkaConfig.groupId}-workspace-events`;
    const workspaceDeletedTopic = kafkaConfig.workspaceDeletedTopic;
    const workspaceMemberLeftTopic = kafkaConfig.workspaceMemberLeftTopic;

    const consumer = kafka.consumer({ groupId: consumerGroup });
    this.consumer = consumer;

    void startKafkaConsumerWithRetry({
      description: `Kafka consumer topic=${workspaceDeletedTopic} group=${consumerGroup}`,
      connect: () => consumer.connect(),
      subscribe: async () => {
        await consumer.subscribe({ topic: workspaceDeletedTopic, fromBeginning: false });
        await consumer.subscribe({ topic: workspaceMemberLeftTopic, fromBeginning: false });
      },
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
              handler: async (record) => {
                if (topic === workspaceMemberLeftTopic) {
                  await this.handleWorkspaceMemberLeft(record);
                  return;
                }

                const payload = toWorkspaceDeletedEventPayload(record);
                if (!payload) {
                  this.logger.warn(
                    `Skipping Kafka workspace_deleted message missing workspaceId/deletedById keys=${Object.keys(record).join(",")}`,
                  );
                  return;
                }

                if (payload.eventId) {
                  const claimed = await this.processedEventRepository.tryClaim(payload.eventId);
                  if (!claimed) {
                    this.logger.log(
                      `workspace_deleted already processed eventId=${payload.eventId} workspaceId=${payload.workspaceId}`,
                    );
                    return;
                  }
                }

                try {
                  const deletedTasks = await this.deletionService.deleteWorkspaceData(
                    payload.workspaceId,
                  );
                  if (payload.eventId) {
                    await this.processedEventRepository.markProcessed(payload.eventId);
                  }
                  this.logger.warn(
                    `workspace_deleted via kafka workspaceId=${payload.workspaceId} deletedTasks=${deletedTasks}`,
                  );
                } catch (error) {
                  if (payload.eventId) {
                    await this.processedEventRepository.releaseClaim(payload.eventId);
                  }
                  throw error;
                }
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

  private async handleWorkspaceMemberLeft(record: Record<string, unknown>): Promise<void> {
    const payload = toWorkspaceMemberLeftEventPayload(record);
    if (!payload) {
      this.logger.warn(
        `Skipping Kafka member_left message missing workspaceId/userId keys=${Object.keys(record).join(",")}`,
      );
      return;
    }

    if (payload.eventId) {
      const claimed = await this.processedEventRepository.tryClaim(payload.eventId);
      if (!claimed) {
        this.logger.log(
          `member_left already processed eventId=${payload.eventId} workspaceId=${payload.workspaceId} userId=${payload.userId}`,
        );
        return;
      }
    }

    try {
      await this.membershipCache.clear(payload.workspaceId, payload.userId);
      if (payload.eventId) {
        await this.processedEventRepository.markProcessed(payload.eventId);
      }
      this.logger.log(
        `member_left invalidated membership cache workspaceId=${payload.workspaceId} userId=${payload.userId}`,
      );
    } catch (error) {
      if (payload.eventId) {
        await this.processedEventRepository.releaseClaim(payload.eventId);
      }
      throw error;
    }
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
