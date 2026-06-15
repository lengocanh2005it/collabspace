import { DeleteTaskHandler } from "./delete-task.handler";
import { DeleteTaskCommand } from "../commands/delete-task.command";
import type { ITaskRepository } from "../ports/ITaskRepository";
import { createMockTaskRepository } from "../../test-utils/mock-task-repository";
import { TaskId } from "../../domain/value-objects/TaskId";

describe("DeleteTaskHandler", () => {
  let handler: DeleteTaskHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    mockTaskRepo = createMockTaskRepository();

    handler = new DeleteTaskHandler(mockTaskRepo);
  });

  it("should delete a task successfully", async () => {
    const command = new DeleteTaskCommand("123e4567-e89b-12d3-a456-426614174000");

    await handler.execute(command);

    expect(mockTaskRepo.deleteAsync).toHaveBeenCalledTimes(1);
    expect(mockTaskRepo.deleteAsync).toHaveBeenCalledWith(expect.any(TaskId));
    expect(mockTaskRepo.deleteAsync.mock.calls[0][0].getValue()).toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
  });
});
