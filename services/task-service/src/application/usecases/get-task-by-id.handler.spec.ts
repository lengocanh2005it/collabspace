import { GetTaskByIdHandler } from "./get-task-by-id.handler";
import { GetTaskByIdQuery } from "../queries/get-task-by-id.query";
import { ITaskRepository } from "../ports/ITaskRepository";
import { createMockTaskRepository } from "../../test-utils/mock-task-repository";
import { Task } from "../../domain/entities/Task";
import { TaskId } from "../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";
import { EntityNotFoundException } from "../../domain/exceptions/EntityNotFoundException";

describe("GetTaskByIdHandler", () => {
  let handler: GetTaskByIdHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    mockTaskRepo = createMockTaskRepository();

    handler = new GetTaskByIdHandler(mockTaskRepo);
  });

  const createMockTask = () => {
    const creatorSnapshot = UserSnapshot.create(
      "creator-1",
      "c@c.c",
      "Creator",
      "Creator",
      "url",
    );
    return Task.restore(
      new TaskId("123e4567-e89b-12d3-a456-426614174000"),
      "Task Title",
      "Desc",
      "TODO",
      "workspace-1",
      null,
      null,
      null,
      creatorSnapshot,
      new Date(),
      new Date(),
      [],
    );
  };

  it("should return task response if task exists", async () => {
    const task = createMockTask();
    const query = new GetTaskByIdQuery("123e4567-e89b-12d3-a456-426614174000");

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);

    const result = await handler.execute(query);

    expect(result).toBeDefined();
    expect(result.id).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(result.title).toBe("Task Title");
    expect(mockTaskRepo.findByIdAsync).toHaveBeenCalledTimes(1);
  });

  it("should throw EntityNotFoundException if task does not exist", async () => {
    const query = new GetTaskByIdQuery("123e4567-e89b-12d3-a456-426614174000");
    mockTaskRepo.findByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(query)).rejects.toThrow(
      EntityNotFoundException,
    );
  });
});
