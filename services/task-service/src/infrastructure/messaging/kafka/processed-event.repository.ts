import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { ProcessedKafkaEvent, type ProcessedKafkaEventDocument } from "./processed-event.schema";

export const PROCESSED_KAFKA_EVENT_REPOSITORY_TOKEN = Symbol(
  "PROCESSED_KAFKA_EVENT_REPOSITORY_TOKEN",
);

export interface IProcessedKafkaEventRepository {
  tryClaim(eventId: string): Promise<boolean>;
  releaseClaim(eventId: string): Promise<void>;
}

@Injectable()
export class ProcessedKafkaEventRepository implements IProcessedKafkaEventRepository {
  constructor(
    @InjectModel(ProcessedKafkaEvent.name)
    private readonly model: Model<ProcessedKafkaEventDocument>,
  ) {}

  async tryClaim(eventId: string): Promise<boolean> {
    try {
      await this.model.create({ eventId, processedAt: new Date() });
      return true;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: number }).code === 11000
      ) {
        return false;
      }
      throw error;
    }
  }

  async releaseClaim(eventId: string): Promise<void> {
    await this.model.deleteOne({ eventId });
  }
}
