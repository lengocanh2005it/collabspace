import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Kafka, type Producer } from "kafkajs";
import { type KafkaDlqEnvelope } from "@collabspace/shared";
import { ConfigurationService } from "../../../configuration/configuration.service";

@Injectable()
export class KafkaDlqPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaDlqPublisher.name);
  private producer: Producer | null = null;

  constructor(private readonly configurationService: ConfigurationService) {}

  async onModuleInit(): Promise<void> {
    const kafkaConfig = this.configurationService.getKafkaConfig();
    if (!kafkaConfig.enabled) {
      return;
    }

    const kafka = new Kafka({
      clientId: `${kafkaConfig.clientId}-dlq`,
      brokers: kafkaConfig.brokers,
    });
    this.producer = kafka.producer();
    await this.producer.connect();
    this.logger.log(`Kafka DLQ producer connected topic=${kafkaConfig.dlqTopic}`);
  }

  async publish(envelope: KafkaDlqEnvelope): Promise<void> {
    if (!this.producer) {
      this.logger.warn("DLQ publish skipped — Kafka consumers disabled or producer not connected");
      return;
    }

    const topic = this.configurationService.getKafkaConfig().dlqTopic;
    await this.producer.send({
      topic,
      messages: [
        {
          key: envelope.sourceTopic,
          value: JSON.stringify(envelope),
        },
      ],
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.producer) {
      return;
    }

    try {
      await this.producer.disconnect();
    } catch (error) {
      this.logger.warn(
        `Kafka DLQ producer shutdown error: ${error instanceof Error ? error.message : "unknown"}`,
      );
    } finally {
      this.producer = null;
    }
  }
}
