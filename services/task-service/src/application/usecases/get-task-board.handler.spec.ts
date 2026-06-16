import { GetTaskBoardHandler } from "./get-task-board.handler";
import { GetTaskBoardQuery } from "../queries/get-task-board.query";
import { createMockTaskRepository } from "../../test-utils/mock-task-repository";
import { Task } from "../../domain/entities/Task";
import { TaskId } from "../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";
import { TASK_BOARD_DEFAULT_LIMIT } from "../ports/task-list-filter";
import type { TaskCommentCountService } from "../services/task-comment-count.service";

describe("GetTaskBoardHandler", () => {
  const repository = createMockTaskRepository();
  const commentCountService: jest.Mocked<Pick<TaskCommentCountService, "attachCommentCounts">> = {
    attachCommentCounts: jest.fn().mockImplementation(async (tasks) => tasks),
  };
  const handler = new GetTaskBoardHandler(
    repository,
    commentCountService as TaskCommentCountService,
  );

  beforeEach(() => jest.clearAllMocks());

  it("groups tasks by board status and filters by project", async () => {
    const creator = UserSnapshot.create(
      "creator",
      "creator@example.com",
      "Creator",
      "Creator",
      null,
    );
    const makeTask = (id: string, status: string) =>
      Task.restore(
        new TaskId(id),
        status,
        "",
        status,
        "workspace-1",
        "project-1",
        null,
        null,
        creator,
        new Date(),
        new Date(),
      );
    repository.findByWorkspaceIdAsync.mockResolvedValue([
      makeTask("00000000-0000-4000-8000-000000000001", "TODO"),
      makeTask("00000000-0000-4000-8000-000000000002", "DOING"),
      makeTask("00000000-0000-4000-8000-000000000003", "DONE"),
    ]);

    const result = await handler.execute(new GetTaskBoardQuery("workspace-1", "project-1"));

    expect(result.total).toBe(3);
    expect(result.columns.map((column) => column.tasks.length)).toEqual([1, 1, 1]);
    expect(repository.findByWorkspaceIdAsync).toHaveBeenCalledWith(
      "workspace-1",
      { projectId: "project-1" },
      { limit: TASK_BOARD_DEFAULT_LIMIT },
    );
  });
});
