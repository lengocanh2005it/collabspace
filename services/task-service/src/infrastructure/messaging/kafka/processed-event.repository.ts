import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { ProcessedKafkaEvent, type ProcessedKafkaEventDocument } from "./processed-event.schema";

export const PROCESSED_KAFKA_EVENT_REPOSITORY_TOKEN = Symbol(
  "PROCESSED_KAFKA_EVENT_REPOSITORY_TOKEN",
);

export interface IProcessedKafkaEventRepository {
  markProcessed(eventId: string): Promise<void>;
  tryClaim(eventId: string): Promise<boolean>;
  releaseClaim(eventId: string): Promise<void>;
}

const DEFAULT_CLAIM_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class ProcessedKafkaEventRepository implements IProcessedKafkaEventRepository {
  constructor(
    @InjectModel(ProcessedKafkaEvent.name)
    private readonly model: Model<ProcessedKafkaEventDocument>,
  ) {}

  async tryClaim(eventId: string): Promise<boolean> {
    const now = new Date();
    const claimedUntil = new Date(now.getTime() + this.getClaimTtlMs());

    try {
      await this.model.create({
        claimedUntil,
        eventId,
        processedAt: null,
      });
      return true;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: number }).code === 11000
      ) {
        const reclaimed = await this.model
          .findOneAndUpdate(
            {
              eventId,
              processedAt: null,
              $or: [{ claimedUntil: null }, { claimedUntil: { $lte: now } }],
            },
            { $set: { claimedUntil } },
            { returnDocument: "after" },
          )
          .lean()
          .exec();

        return reclaimed !== null;
      }
      throw error;
    }
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.model.updateOne(
      { eventId },
      {
        $set: {
          claimedUntil: null,
          processedAt: new Date(),
        },
      },
    );
  }

  async releaseClaim(eventId: string): Promise<void> {
    await this.model.deleteOne({ eventId, processedAt: null });
  }

  private getClaimTtlMs(): number {
    const configured = Number(process.env.KAFKA_EVENT_CLAIM_TTL_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_CLAIM_TTL_MS;
  }
}
