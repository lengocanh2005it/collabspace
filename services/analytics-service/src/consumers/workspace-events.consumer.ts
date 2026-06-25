import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Kafka, type Consumer } from 'kafkajs';
import {
  WorkspaceCreatedEventSchema,
  WorkspaceMemberJoinedEventSchema,
  WorkspaceMemberLeftEventSchema,
  WorkspaceProjectCreatedEventSchema,
  processKafkaConsumerMessage,
  startKafkaConsumerWithRetry,
} from '@collabspace/shared';
import { ConfigurationService } from '../config/configuration.service.js';
import { AnalyticsRepository } from '../analytics/repositories/analytics.repository.js';
import { KafkaDlqPublisher } from './kafka-dlq.publisher.js';
import { parseKafkaJsonValue, today } from './kafka-message.parser.js';

@Injectable()
export class WorkspaceEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkspaceEventsConsumer.name);
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
    const consumerGroup = `${kafkaConfig.groupId}-workspace-events`;

    const topics = [
      kafkaConfig.workspaceCreatedTopic,
      kafkaConfig.workspaceProjectCreatedTopic,
      kafkaConfig.workspaceMemberJoinedTopic,
      kafkaConfig.workspaceMemberLeftTopic,
    ];
    const consumer = kafka.consumer({ groupId: consumerGroup });
    this.consumer = consumer;

    void startKafkaConsumerWithRetry({
      description: `Kafka consumer topics=${topics.join(',')} group=${consumerGroup}`,
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
              publishToDlq: (envelope) => this.dlqPublisher.publish(envelope),
              log: this.logger,
              parseValue: parseKafkaJsonValue,
              handler: (record, topic) => this.handleWorkspaceEvent(record, topic),
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

  async handleWorkspaceEvent(
    record: Record<string, unknown>,
    topic = 'collabspace.workspace.workspace_created',
  ): Promise<void> {
    const kafkaConfig = this.configurationService.getKafkaConfig();
    const type = this.resolveEventType(topic, kafkaConfig);

    switch (type) {
      case 'workspace_created':
        await this.handleWorkspaceCreated(record, topic);
        break;

      case 'project_created':
        await this.handleProjectCreated(record, topic);
        break;

      case 'member_joined':
        await this.handleMemberJoined(record, topic);
        break;

      case 'member_left':
        await this.handleMemberLeft(record, topic);
        break;

      default:
        this.logger.warn(`Skipping unknown workspace event type=${type ?? 'undefined'}`);
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

  private async handleWorkspaceCreated(
    record: Record<string, unknown>,
    topic: string,
  ): Promise<void> {
    const payload = WorkspaceCreatedEventSchema.safeParse(record);
    if (!payload.success) {
      this.logger.warn(
        `Skipping invalid workspace_created analytics event keys=${Object.keys(record).join(',')}`,
      );
      return;
    }

    const processed = await this.repository.processEventOnce(
      payload.data.eventId,
      'workspace_created',
      topic,
      async () => {
        await this.repository.incrementSnapshot('workspaces.total', 1);
        await this.repository.incrementSnapshot('workspaces.totalMembers', 1);
        await this.repository.incrementTimeseries(
          this.getEventDate(payload.data.occurredAt),
          'workspaces_created',
          1,
        );
      },
    );
    if (processed) this.logger.log(`Processed workspace_created event ${payload.data.workspaceId}`);
  }

  private async handleProjectCreated(
    record: Record<string, unknown>,
    topic: string,
  ): Promise<void> {
    const payload = WorkspaceProjectCreatedEventSchema.safeParse(record);
    if (!payload.success) {
      this.logger.warn(
        `Skipping invalid project_created analytics event keys=${Object.keys(record).join(',')}`,
      );
      return;
    }

    const processed = await this.repository.processEventOnce(
      payload.data.eventId,
      'project_created',
      topic,
      async () => {
        await this.repository.incrementSnapshot('projects.total', 1);
      },
    );
    if (processed) this.logger.log(`Processed project_created event ${payload.data.projectId}`);
  }

  private async handleMemberJoined(record: Record<string, unknown>, topic: string): Promise<void> {
    const payload = WorkspaceMemberJoinedEventSchema.safeParse(record);
    if (!payload.success) {
      this.logger.warn(
        `Skipping invalid member_joined analytics event keys=${Object.keys(record).join(',')}`,
      );
      return;
    }

    const processed = await this.repository.processEventOnce(
      payload.data.eventId,
      'member_joined',
      topic,
      async () => {
        await this.repository.incrementSnapshot('workspaces.totalMembers', 1);
      },
    );
    if (processed) this.logger.log(`Processed member_joined event ${payload.data.userId}`);
  }

  private async handleMemberLeft(record: Record<string, unknown>, topic: string): Promise<void> {
    const payload = WorkspaceMemberLeftEventSchema.safeParse(record);
    if (!payload.success) {
      this.logger.warn(
        `Skipping invalid member_left analytics event keys=${Object.keys(record).join(',')}`,
      );
      return;
    }

    const processed = await this.repository.processEventOnce(
      payload.data.eventId,
      'member_left',
      topic,
      async () => {
        await this.repository.decrementSnapshot('workspaces.totalMembers', 1);
      },
    );
    if (processed) this.logger.log(`Processed member_left event ${payload.data.userId}`);
  }

  private resolveEventType(
    topic: string,
    kafkaConfig: ReturnType<ConfigurationService['getKafkaConfig']>,
  ) {
    if (topic === kafkaConfig.workspaceCreatedTopic) return 'workspace_created';
    if (topic === kafkaConfig.workspaceProjectCreatedTopic) return 'project_created';
    if (topic === kafkaConfig.workspaceMemberJoinedTopic) return 'member_joined';
    if (topic === kafkaConfig.workspaceMemberLeftTopic) return 'member_left';
    return typeof topic === 'string' && topic.length > 0 ? topic.split('.').at(-1) : undefined;
  }

  private getEventDate(occurredAt?: string): string {
    if (!occurredAt) return today();
    const timestamp = Date.parse(occurredAt);
    if (Number.isNaN(timestamp)) return today();
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}
