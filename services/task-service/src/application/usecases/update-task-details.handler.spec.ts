import { UpdateTaskDetailsHandler } from "./update-task-details.handler";
import { UpdateTaskDetailsCommand } from "../commands/update-task-details.command";
import { ITaskRepository } from "../ports/ITaskRepository";
import { Task } from "../../domain/entities/Task";
import { TaskId } from "../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";
import { EntityNotFoundException } from "../../domain/exceptions/EntityNotFoundException";
import { BusinessRuleException } from "../../domain/exceptions/BusinessRuleException";

describe("UpdateTaskDetailsHandler", () => {
  let handler: UpdateTaskDetailsHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    mockTaskRepo = {
      addAsync: jest.fn(),
      updateAsync: jest.fn(),
      deleteAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      findByWorkspaceIdAsync: jest.fn(),
    };

    handler = new UpdateTaskDetailsHandler(mockTaskRepo);
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
      "Old Title",
      "Old Desc",
      "TODO",
      "workspace-1",
      null,
      null,
      creatorSnapshot,
      new Date(),
      new Date(),
      [],
    );
  };

  it("should update task details successfully", async () => {
    const task = createMockTask();
    const command = new UpdateTaskDetailsCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "New Title",
      "New Desc",
    );

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);

    await handler.execute(command);

    expect(task.getTitle()).toBe("New Title");
    expect(task.getDescription()).toBe("New Desc");
    expect(mockTaskRepo.updateAsync).toHaveBeenCalledWith(task);
  });

  it("should throw EntityNotFoundException if task does not exist", async () => {
    const command = new UpdateTaskDetailsCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "New Title",
      "New Desc",
    );
    mockTaskRepo.findByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(
      EntityNotFoundException,
    );
    expect(mockTaskRepo.updateAsync).not.toHaveBeenCalled();
  });

  it("should throw BusinessRuleException if title is empty", async () => {
    const task = createMockTask();
    const command = new UpdateTaskDetailsCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "",
      "New Desc",
    );

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);

    await expect(handler.execute(command)).rejects.toThrow(
      BusinessRuleException,
    );
    expect(mockTaskRepo.updateAsync).not.toHaveBeenCalled();
  });
});
