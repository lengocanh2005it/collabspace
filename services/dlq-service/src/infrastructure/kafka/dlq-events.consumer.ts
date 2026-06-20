import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Kafka, type Consumer } from 'kafkajs';
import type { KafkaDlqEnvelope } from '@collabspace/shared';
import { ConfigurationService } from '../../configuration/configuration.service';
import { DlqIngestService } from '../../application/dlq-ingest.service';

@Injectable()
export class DlqEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DlqEventsConsumer.name);
  private consumer: Consumer | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigurationService,
    private readonly ingestService: DlqIngestService,
  ) {}

  async onModuleInit(): Promise<void> {
    const kafkaConfig = this.config.getKafkaConfig();
    if (!kafkaConfig.enabled) {
      this.logger.log('Kafka consumers disabled (KAFKA_CONSUMERS_ENABLED=false).');
      return;
    }

    const kafka = new Kafka({
      clientId: kafkaConfig.clientId,
      brokers: kafkaConfig.brokers,
    });

    this.consumer = kafka.consumer({ groupId: kafkaConfig.groupId });
    await this.consumer.connect();
    await this.consumer.subscribe({ topics: [kafkaConfig.dlqTopic], fromBeginning: false });

    this.runPromise = this.consumer.run({
      eachMessage: async ({ partition, message }) => {
        const rawValue = message.value?.toString();
        if (!rawValue) {
          this.logger.warn(
            `DLQ consumer: empty message value at partition=${partition} offset=${message.offset}`,
          );
          return;
        }

        let envelope: KafkaDlqEnvelope;
        try {
          envelope = JSON.parse(rawValue) as KafkaDlqEnvelope;
        } catch (err) {
          this.logger.error(
            `DLQ consumer: failed to parse message at partition=${partition} offset=${message.offset}: ${err instanceof Error ? err.message : String(err)}`,
          );
          return;
        }

        if (envelope.version !== 1) {
          this.logger.warn(
            `DLQ consumer: unsupported envelope version=${String(envelope.version)} at partition=${partition} offset=${message.offset} — skipping`,
          );
          return;
        }

        try {
          await this.ingestService.ingest(envelope);
        } catch (err) {
          // Log but do not re-throw — commit the offset to avoid infinite loop.
          // The message is already in MongoDB or failed due to a transient DB error;
          // ops should be alerted via Prometheus dlq_consumer_events_ingested_total drop.
          this.logger.error(
            `DLQ consumer: ingest failed for topic=${envelope.sourceTopic} offset=${envelope.offset}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    });

    this.logger.log(
      `DLQ Kafka consumer ready: topic=${kafkaConfig.dlqTopic} group=${kafkaConfig.groupId}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.consumer) return;
    try {
      await this.consumer.stop();
      await this.runPromise?.catch(() => undefined);
      await this.consumer.disconnect();
    } catch (err) {
      this.logger.warn(
        `DLQ consumer shutdown error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.consumer = null;
      this.runPromise = null;
    }
  }
}
