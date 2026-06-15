import { EventSourcedMongoTaskRepository } from "./event-sourced-mongo-task.repository";
import { Task } from "../../domain/entities/Task";
import { TaskId } from "../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";
import { TaskDomainEventType } from "../../domain/events/task-domain.events";
import type { ITaskEventStore } from "../../application/ports/ITaskEventStore";
import type { ITaskActivityRepository } from "../../application/ports/ITaskActivityRepository";
import type { Model } from "mongoose";
import type { TaskPersistence } from "../persistence/task.schema";

describe("EventSourcedMongoTaskRepository", () => {
  const taskId = new TaskId("123e4567-e89b-12d3-a456-426614174000");
  const creator = UserSnapshot.create("creator-1", "creator@test.com", "Creator", "Creator", null);

  let repository: EventSourcedMongoTaskRepository;
  let mockEventStore: jest.Mocked<ITaskEventStore>;
  let mockTaskActivityRepository: jest.Mocked<ITaskActivityRepository>;
  let mockTaskModel: jest.Mocked<Model<TaskPersistence>>;

  beforeEach(() => {
    mockEventStore = {
      loadStream: jest.fn(),
      getStreamVersion: jest.fn(),
      append: jest.fn(),
    };

    mockTaskActivityRepository = {
      appendFromEventsAsync: jest.fn().mockResolvedValue(undefined),
      appendFromCommentAsync: jest.fn(),
      findByTaskIdAsync: jest.fn(),
      countByTaskIdAsync: jest.fn(),
    };

    mockTaskModel = {
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn() }),
      deleteOne: jest.fn().mockReturnValue({ exec: jest.fn() }),
    } as unknown as jest.Mocked<Model<TaskPersistence>>;

    repository = new EventSourcedMongoTaskRepository(
      mockTaskModel,
      mockEventStore,
      mockTaskActivityRepository,
    );
  });

  it("syncs projection from in-memory aggregate without reloading the stream", async () => {
    const task = Task.create(taskId, "Title", "Description", "workspace-1", creator);
    const uncommitted = [...task.getUncommittedEvents()];

    mockEventStore.append.mockResolvedValue(
      uncommitted.map((event, index) => ({
        ...event,
        streamId: taskId.getValue(),
        version: index + 1,
      })),
    );

    await repository.saveAsync(task);

    expect(mockEventStore.loadStream).not.toHaveBeenCalled();
    expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
      taskId.getValue(),
      expect.objectContaining({
        title: "Title",
        workspaceId: "workspace-1",
      }),
      { upsert: true, new: true },
    );
    expect(mockTaskModel.deleteOne).not.toHaveBeenCalled();
    expect(mockTaskActivityRepository.appendFromEventsAsync).toHaveBeenCalledWith(
      taskId.getValue(),
      expect.arrayContaining([
        expect.objectContaining({ eventType: TaskDomainEventType.TaskCreated }),
      ]),
    );
  });

  it("deletes projection when aggregate is deleted without reloading the stream", async () => {
    const task = Task.create(taskId, "Title", "Description", "workspace-1", creator);
    task.clearUncommittedEvents();
    task.delete();
    const uncommitted = [...task.getUncommittedEvents()];

    mockEventStore.append.mockResolvedValue(
      uncommitted.map((event, index) => ({
        ...event,
        streamId: taskId.getValue(),
        version: index + 1,
      })),
    );

    await repository.saveAsync(task);

    expect(mockEventStore.loadStream).not.toHaveBeenCalled();
    expect(mockTaskModel.deleteOne).toHaveBeenCalledWith({
      _id: taskId.getValue(),
    });
    expect(mockTaskModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(uncommitted[0].eventType).toBe(TaskDomainEventType.TaskDeleted);
  });
});
