import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MongoConfig = { uri: string };

export type KafkaConfig = {
  enabled: boolean;
  brokers: string[];
  clientId: string;
  groupId: string;
  dlqTopic: string;
};

export type DlqSchedulerConfig = {
  autoRetryEnabled: boolean;
  batchSize: number;
  maxRetriesTransient: number;
  maxRetriesUnknown: number;
};

@Injectable()
export class ConfigurationService {
  constructor(private readonly configService: ConfigService) {}

  getMongoConfig(): MongoConfig {
    const uri = this.configService.get<string>('MONGO_URI');
    if (!uri) throw new Error('MONGO_URI is missing in environment variables!');
    return { uri };
  }

  getKafkaConfig(): KafkaConfig {
    const brokersRaw = this.configService.get<string>('KAFKA_BROKERS') ?? 'kafka:9092';

    return {
      enabled: this.configService.get<string>('KAFKA_CONSUMERS_ENABLED') === 'true',
      brokers: brokersRaw
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean),
      clientId: this.configService.get<string>('KAFKA_CLIENT_ID') ?? 'dlq-service',
      groupId: this.configService.get<string>('KAFKA_GROUP_ID') ?? 'dlq-service',
      dlqTopic: this.configService.get<string>('KAFKA_DLQ_TOPIC') ?? 'collabspace.dlq.events',
    };
  }

  getJwtConfig() {
    return {
      secret: this.configService.get<string>('JWT_SECRET'),
    };
  }

  getDlqSchedulerConfig(): DlqSchedulerConfig {
    return {
      autoRetryEnabled: this.configService.get<string>('DLQ_AUTO_RETRY_ENABLED') !== 'false',
      batchSize: Number.parseInt(
        this.configService.get<string>('DLQ_AUTO_RETRY_BATCH_SIZE') ?? '50',
        10,
      ),
      maxRetriesTransient: Number.parseInt(
        this.configService.get<string>('DLQ_MAX_RETRIES_TRANSIENT') ?? '3',
        10,
      ),
      maxRetriesUnknown: Number.parseInt(
        this.configService.get<string>('DLQ_MAX_RETRIES_UNKNOWN') ?? '1',
        10,
      ),
    };
  }

  getInstanceId(): string {
    return this.configService.get<string>('INSTANCE_ID') ?? 'dlq-service-local';
  }
}
