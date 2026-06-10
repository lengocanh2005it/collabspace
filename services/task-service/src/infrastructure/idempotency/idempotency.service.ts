import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  IdempotencyKeyRecord,
  IdempotencyKeyDocument,
} from "./idempotency-key.schema";

export type CachedIdempotentResponse = {
  body: Record<string, unknown>;
  statusCode: number;
};

const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectModel(IdempotencyKeyRecord.name)
    private readonly idempotencyModel: Model<IdempotencyKeyDocument>,
  ) {}

  async findCached(
    userId: string,
    idempotencyKey: string,
  ): Promise<CachedIdempotentResponse | null> {
    const record = await this.idempotencyModel.findOne({
      expiresAt: { $gt: new Date() },
      idempotencyKey,
      userId,
    });

    if (!record) {
      return null;
    }

    return {
      body: record.responseBody,
      statusCode: record.statusCode,
    };
  }

  async store(
    userId: string,
    idempotencyKey: string,
    route: string,
    statusCode: number,
    responseBody: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.idempotencyModel.create({
        expiresAt: new Date(Date.now() + TTL_MS),
        idempotencyKey,
        responseBody,
        route,
        statusCode,
        userId,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: number }).code === 11000
      ) {
        return;
      }

      throw error;
    }
  }
}
