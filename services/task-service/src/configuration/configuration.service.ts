import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type MongoConfig = {
  uri: string;
};

export type KafkaConfig = {
  enabled: boolean;
  brokers: string[];
  clientId: string;
  groupId: string;
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
      clientId: this.configService.get<string>("KAFKA_CLIENT_ID") ?? "task-service",
      groupId: this.configService.get<string>("KAFKA_GROUP_ID") ?? "task-service",
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
}
