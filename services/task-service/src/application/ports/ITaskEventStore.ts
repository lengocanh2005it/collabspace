// src/application/ports/ITaskEventStore.ts
import type {
  StoredTaskDomainEvent,
  UncommittedTaskDomainEvent,
} from "../../domain/events/task-domain.events";
import type { MongoSessionOptions } from "../../application/ports/mongo-session-options";

export const ITaskEventStore = Symbol("ITaskEventStore");

export interface ITaskEventStore {
  loadStream(streamId: string): Promise<StoredTaskDomainEvent[]>;
  getStreamVersion(streamId: string): Promise<number>;
  append(
    streamId: string,
    expectedVersion: number,
    events: UncommittedTaskDomainEvent[],
    options?: MongoSessionOptions,
  ): Promise<StoredTaskDomainEvent[]>;
}
