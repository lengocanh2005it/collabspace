// src/infrastructure/repositories/mongo-task-event.store.ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { ITaskEventStore } from "../../application/ports/ITaskEventStore";
import type {
  StoredTaskDomainEvent,
  UncommittedTaskDomainEvent,
} from "../../domain/events/task-domain.events";
import { ConcurrencyException } from "../../domain/exceptions/ConcurrencyException";
import { TaskEventPersistence } from "../persistence/task-event.schema";

@Injectable()
export class MongoTaskEventStore implements ITaskEventStore {
  constructor(
    @InjectModel(TaskEventPersistence.name)
    private readonly eventModel: Model<TaskEventPersistence>,
  ) {}

  async loadStream(streamId: string): Promise<StoredTaskDomainEvent[]> {
    const docs = await this.eventModel.find({ streamId }).sort({ version: 1 }).exec();

    return docs.map((doc) => this.toStoredEvent(doc));
  }

  async getStreamVersion(streamId: string): Promise<number> {
    const latest = await this.eventModel
      .findOne({ streamId })
      .sort({ version: -1 })
      .select({ version: 1 })
      .lean()
      .exec();

    return latest?.version ?? 0;
  }

  async append(
    streamId: string,
    expectedVersion: number,
    events: UncommittedTaskDomainEvent[],
  ): Promise<StoredTaskDomainEvent[]> {
    if (events.length === 0) {
      return [];
    }

    const currentVersion = await this.getStreamVersion(streamId);
    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyException(
        `Task stream ${streamId} version mismatch: expected ${expectedVersion}, found ${currentVersion}`,
      );
    }

    const storedEvents: StoredTaskDomainEvent[] = events.map((event, index) => ({
      ...event,
      streamId,
      version: expectedVersion + index + 1,
    }));

    try {
      await this.eventModel.insertMany(
        storedEvents.map((event) => ({
          streamId: event.streamId,
          version: event.version,
          eventId: event.eventId,
          eventType: event.eventType,
          occurredAt: new Date(event.occurredAt),
          payload: event.payload as unknown as Record<string, unknown>,
        })),
      );
    } catch (error) {
      const mongoError = error as { code?: number };
      if (mongoError.code === 11000) {
        throw new ConcurrencyException(
          `Task stream ${streamId} append failed due to duplicate version`,
        );
      }
      throw error;
    }

    return storedEvents;
  }

  private toStoredEvent(doc: TaskEventPersistence): StoredTaskDomainEvent {
    return {
      streamId: doc.streamId,
      version: doc.version,
      eventId: doc.eventId,
      eventType: doc.eventType as StoredTaskDomainEvent["eventType"],
      occurredAt: doc.occurredAt.toISOString(),
      payload: doc.payload as unknown as StoredTaskDomainEvent["payload"],
    };
  }
}
