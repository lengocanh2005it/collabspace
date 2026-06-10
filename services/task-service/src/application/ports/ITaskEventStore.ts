// src/application/ports/ITaskEventStore.ts
import type {
  StoredTaskDomainEvent,
  UncommittedTaskDomainEvent,
} from "../../domain/events/task-domain.events";

export const ITaskEventStore = Symbol("ITaskEventStore");

export interface ITaskEventStore {
  loadStream(streamId: string): Promise<StoredTaskDomainEvent[]>;
  getStreamVersion(streamId: string): Promise<number>;
  append(
    streamId: string,
    expectedVersion: number,
    events: UncommittedTaskDomainEvent[],
  ): Promise<StoredTaskDomainEvent[]>;
}
