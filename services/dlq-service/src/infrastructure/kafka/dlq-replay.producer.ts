import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Kafka, type Producer } from 'kafkajs';
import type { DlqRecord } from '../../domain/dlq-record.schema';
import { ConfigurationService } from '../../configuration/configuration.service';

export type ReplayProduceOptions = {
  record: DlqRecord & { _id: { toString(): string } };
  triggeredBy: string;
  attemptNumber: number;
};

@Injectable()
export class DlqReplayProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DlqReplayProducer.name);
  private producer: Producer | null = null;

  constructor(private readonly config: ConfigurationService) {}

  async onModuleInit(): Promise<void> {
    const kafkaConfig = this.config.getKafkaConfig();
    if (!kafkaConfig.enabled) {
      this.logger.log('Kafka producer disabled (KAFKA_CONSUMERS_ENABLED=false).');
      return;
    }

    const kafka = new Kafka({
      clientId: `${kafkaConfig.clientId}-replay-producer`,
      brokers: kafkaConfig.brokers,
    });

    this.producer = kafka.producer();
    await this.producer.connect();
    this.logger.log('DLQ replay Kafka producer connected.');
  }

  async produce(options: ReplayProduceOptions): Promise<void> {
    if (!this.producer) {
      throw new Error('Kafka producer not initialized (KAFKA_CONSUMERS_ENABLED=false)');
    }

    const { record, triggeredBy, attemptNumber } = options;
    const now = new Date().toISOString();

    await this.producer.send({
      topic: record.sourceTopic,
      messages: [
        {
          key: record.sourceKey ?? undefined,
          value: JSON.stringify(record.payload),
          headers: {
            'x-dlq-replayed': 'true',
            'x-dlq-record-id': record._id.toString(),
            'x-dlq-source-topic': record.sourceTopic,
            'x-replay-attempt': String(attemptNumber),
            'x-replayed-by': triggeredBy,
            'x-replayed-at': now,
          },
        },
      ],
    });

    this.logger.log(
      `DLQ replay produced: recordId=${record._id.toString()} topic=${record.sourceTopic} attempt=${attemptNumber} by=${triggeredBy}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.producer) return;
    try {
      await this.producer.disconnect();
    } catch (err) {
      this.logger.warn(
        `DLQ replay producer shutdown error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.producer = null;
    }
  }
}
