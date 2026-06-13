import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type MongoConfig = {
  uri: string;
};

export type AzureStorageConfig = {
  connectionString: string;
  containerName: string;
  maxFileSize: number;
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

  getAzureStorageConfig(): AzureStorageConfig {
    const connectionString = this.configService.get<string>(
      "AZURE_STORAGE_CONNECTION_STRING",
    );

    if (!connectionString) {
      throw new Error("AZURE_STORAGE_CONNECTION_STRING is missing!");
    }

    return {
      connectionString,
      containerName:
        this.configService.get<string>("AZURE_STORAGE_CONTAINER_NAME") ??
        "task-attachments",
      maxFileSize:
        Number(this.configService.get<number>("AZURE_STORAGE_MAX_FILE_SIZE")) ||
        5242880,
    };
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

      queue:
        this.configService.get<string>("RABBITMQ_QUEUE") ??
        "notification-service",

      // Mặc định là true, trừ khi cố tình ghi 'false'
      queueDurable:
        this.configService.get<string>("RABBITMQ_QUEUE_DURABLE") !== "false",

      // Ép kiểu từ String sang Number
      prefetchCount:
        Number(this.configService.get<number>("RABBITMQ_PREFETCH_COUNT")) || 10,

      noAck: this.configService.get<string>("RABBITMQ_NO_ACK") === "true",

      maxRetries:
        Number(this.configService.get<number>("RABBITMQ_MAX_RETRIES")) || 5,

      deadLetterExchange:
        this.configService.get<string>("RABBITMQ_DLX_EXCHANGE") ??
        "collabspace_dlx",

      deadLetterRoutingKey:
        this.configService.get<string>("RABBITMQ_DLX_ROUTING_KEY") ??
        "notification-service.dlq",
    };
  }

  getJwtConfig() {
    return {
      secret: this.configService.get<string>("JWT_SECRET"),
    };
  }
}
