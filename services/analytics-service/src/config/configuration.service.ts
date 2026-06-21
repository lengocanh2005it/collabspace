import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MongoConfig = {
  uri: string;
};

export type KafkaConfig = {
  enabled: boolean;
  brokers: string[];
  clientId: string;
  groupId: string;
  dlqTopic: string;
  maxRetries: number;
  retryDelayMs: number;
  authEventsTopic: string;
  workspaceEventsTopic: string;
  taskEventsTopic: string;
};

@Injectable()
export class ConfigurationService {
  constructor(private readonly configService: ConfigService) {}

  getMongoConfig(): MongoConfig {
    const uri = this.configService.get<string>('MONGO_URI');

    if (!uri) {
      throw new Error('MONGO_URI is missing in environment variables!');
    }

    return { uri };
  }

  getKafkaConfig(): KafkaConfig {
    const brokersRaw = this.configService.get<string>('KAFKA_BROKERS') ?? 'kafka:9092';

    return {
      enabled: this.configService.get<string>('KAFKA_CONSUMERS_ENABLED') === 'true',
      brokers: brokersRaw
        .split(',')
        .map((b) => b.trim())
        .filter((b) => b.length > 0),
      clientId: this.configService.get<string>('KAFKA_CLIENT_ID') ?? 'analytics-service',
      groupId: this.configService.get<string>('KAFKA_GROUP_ID') ?? 'analytics-service',
      dlqTopic: this.configService.get<string>('KAFKA_DLQ_TOPIC') ?? 'collabspace.dlq.events',
      maxRetries: Number.parseInt(
        this.configService.get<string>('KAFKA_CONSUMER_MAX_RETRIES') ?? '3',
        10,
      ),
      retryDelayMs: Number.parseInt(
        this.configService.get<string>('KAFKA_CONSUMER_RETRY_DELAY_MS') ?? '1000',
        10,
      ),
      authEventsTopic:
        this.configService.get<string>('KAFKA_TOPIC_AUTH_EVENTS') ?? 'collabspace.auth.events',
      workspaceEventsTopic:
        this.configService.get<string>('KAFKA_TOPIC_WORKSPACE_EVENTS') ??
        'collabspace.workspace.events',
      taskEventsTopic:
        this.configService.get<string>('KAFKA_TOPIC_TASK_EVENTS') ?? 'collabspace.task.events',
    };
  }

  getJwtConfig() {
    return {
      secret: this.configService.get<string>('JWT_SECRET'),
    };
  }
}
