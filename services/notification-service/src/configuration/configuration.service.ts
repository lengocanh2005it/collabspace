import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type MongoConfig = {
  uri: string;
};

// 1. Thêm định nghĩa Type cho RabbitMQ
export type RabbitMqConfig = {
  enabled: boolean;
  url: string;
  queue: string;
  queueDurable: boolean;
  prefetchCount: number;
  noAck: boolean;
  maxRetries: number;
  deadLetterExchange: string;
  deadLetterRoutingKey: string;
};

export type KafkaConfig = {
  enabled: boolean;
  brokers: string[];
  clientId: string;
  groupId: string;
  workspaceInvitedTopic: string;
  workspaceDeletedTopic: string;
  userProfileUpdatedTopic: string;
  userRegisteredTopic: string;
};

@Injectable()
export class ConfigurationService {
  constructor(private readonly configService: ConfigService) {}

  getMongoConfig(): MongoConfig {
    const uri = this.configService.get<string>("MONGO_URI");

    if (!uri) {
      throw new Error("MONGO_URI is missing in environment variables!");
    }

    return { uri };
  }

  // 2. Thêm hàm lấy cấu hình RabbitMQ
  getRabbitMqConfig(): RabbitMqConfig {
    const url = this.configService.get<string>("RABBITMQ_URL");

    if (!url) {
      throw new Error("RABBITMQ_URL is missing in environment variables!");
    }

    return {
      enabled: this.configService.get<string>("RABBITMQ_ENABLED") !== "false",

      url,

      queue: this.configService.get<string>("RABBITMQ_QUEUE") ?? "notification-service",

      // Mặc định là true, trừ khi cố tình ghi 'false'
      queueDurable: this.configService.get<string>("RABBITMQ_QUEUE_DURABLE") !== "false",

      // Ép kiểu từ String sang Number
      prefetchCount: Number(this.configService.get<number>("RABBITMQ_PREFETCH_COUNT")) || 10,

      noAck: this.configService.get<string>("RABBITMQ_NO_ACK") === "true",

      maxRetries: Number(this.configService.get<number>("RABBITMQ_MAX_RETRIES")) || 5,

      deadLetterExchange:
        this.configService.get<string>("RABBITMQ_DLX_EXCHANGE") ?? "collabspace_dlx",

      deadLetterRoutingKey:
        this.configService.get<string>("RABBITMQ_DLX_ROUTING_KEY") ?? "notification-service.dlq",
    };
  }

  getKafkaConfig(): KafkaConfig {
    const brokersRaw =
      this.configService.get<string>("KAFKA_BROKERS") ??
      this.configService.get<string>("KAFKA_BROKERS_HOST") ??
      "kafka:9092";

    return {
      enabled: this.configService.get<string>("KAFKA_CONSUMERS_ENABLED") === "true",
      brokers: brokersRaw
        .split(",")
        .map((broker) => broker.trim())
        .filter((broker) => broker.length > 0),
      clientId: this.configService.get<string>("KAFKA_CLIENT_ID") ?? "notification-service",
      groupId: this.configService.get<string>("KAFKA_GROUP_ID") ?? "notification-service",
      workspaceInvitedTopic:
        this.configService.get<string>("KAFKA_TOPIC_WORKSPACE_INVITED") ??
        "collabspace.workspace.workspace_invited",
      workspaceDeletedTopic:
        this.configService.get<string>("KAFKA_TOPIC_WORKSPACE_DELETED") ??
        "collabspace.workspace.workspace_deleted",
      userProfileUpdatedTopic:
        this.configService.get<string>("KAFKA_TOPIC_USER_PROFILE_UPDATED") ??
        "collabspace.user.profile_updated",
      userRegisteredTopic:
        this.configService.get<string>("KAFKA_TOPIC_USER_REGISTERED") ??
        "collabspace.user.registered",
    };
  }

  getJwtConfig() {
    return {
      secret: this.configService.get<string>("JWT_SECRET"),
    };
  }
}
