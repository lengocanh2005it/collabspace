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
    const now = new Date();
    const claimedUntil = new Date(now.getTime() + this.getClaimTtlMs());

    try {
      await this.processedEventModel.create({
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
        const reclaimed = await this.processedEventModel
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
    await this.processedEventModel.updateOne(
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
    await this.processedEventModel.deleteOne({ eventId, processedAt: null });
  }

  private getClaimTtlMs(): number {
    const configured = Number(process.env.KAFKA_EVENT_CLAIM_TTL_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : 5 * 60 * 1000;
  }
}
