import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { IProcessedEventRepository } from "../../../domain/repositories/IProcessedEventRepository";
import { ProcessedEvent, type ProcessedEventDocument } from "../schemas/processed-event.schema";

@Injectable()
export class ProcessedEventRepository implements IProcessedEventRepository {
  constructor(
    @InjectModel(ProcessedEvent.name)
    private readonly processedEventModel: Model<ProcessedEventDocument>,
  ) {}

  async tryClaim(eventId: string): Promise<boolean> {
    try {
      await this.processedEventModel.create({
        eventId,
        processedAt: new Date(),
      });
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
}
