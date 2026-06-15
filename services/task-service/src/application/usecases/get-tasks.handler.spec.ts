import { GetTasksHandler } from "./get-tasks.handler";
import { GetTasksQuery } from "../queries/get-tasks.query";
import type { ITaskRepository } from "../ports/ITaskRepository";
import { createMockTaskRepository } from "../../test-utils/mock-task-repository";
import { Task } from "../../domain/entities/Task";
import { TaskId } from "../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";
import { TASK_LIST_DEFAULT_LIMIT } from "../ports/task-list-filter";

describe("GetTasksHandler", () => {
  let handler: GetTasksHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    mockTaskRepo = createMockTaskRepository();

    handler = new GetTasksHandler(mockTaskRepo);
  });

  const createMockTask = (id: string, status: string, assigneeId: string | null) => {
    const creatorSnapshot = UserSnapshot.create("creator-1", "c@c.c", "Creator", "Creator", "url");
    return Task.restore(
      new TaskId(id),
      "Task Title",
      "Desc",
      status,
      "workspace-1",
      null,
      assigneeId,
      assigneeId ? UserSnapshot.create(assigneeId, "a@a.c", "Assignee", "Assignee", "url") : null,
      creatorSnapshot,
      new Date(),
      new Date(),
      [],
    );
  };

  it("should return all tasks for a workspace", async () => {
    const tasks = [
      createMockTask("123e4567-e89b-12d3-a456-426614174002", "TODO", null),
      createMockTask("123e4567-e89b-12d3-a456-426614174003", "DOING", "user-1"),
    ];

    mockTaskRepo.findByWorkspaceIdAsync.mockResolvedValue(tasks);
    mockTaskRepo.countByWorkspaceIdAsync.mockResolvedValue(2);

    const query = new GetTasksQuery("workspace-1");
    const result = await handler.execute(query);

    expect(result.total).toBe(2);
    expect(result.tasks).toHaveLength(2);
    expect(result.skip).toBe(0);
    expect(result.limit).toBe(TASK_LIST_DEFAULT_LIMIT);
    expect(mockTaskRepo.findByWorkspaceIdAsync).toHaveBeenCalledWith("workspace-1", undefined, {
      skip: 0,
      limit: TASK_LIST_DEFAULT_LIMIT,
    });
    expect(mockTaskRepo.countByWorkspaceIdAsync).toHaveBeenCalledWith("workspace-1", undefined);
  });

  it("should pass status filter to the repository", async () => {
    const task = createMockTask("123e4567-e89b-12d3-a456-426614174002", "TODO", null);

    mockTaskRepo.findByWorkspaceIdAsync.mockResolvedValue([task]);
    mockTaskRepo.countByWorkspaceIdAsync.mockResolvedValue(1);

    const query = new GetTasksQuery("workspace-1", undefined, "TODO");
    const result = await handler.execute(query);

    expect(result.total).toBe(1);
    expect(result.tasks[0].id).toBe("123e4567-e89b-12d3-a456-426614174002");
    expect(mockTaskRepo.findByWorkspaceIdAsync).toHaveBeenCalledWith(
      "workspace-1",
      { status: "TODO" },
      { skip: 0, limit: TASK_LIST_DEFAULT_LIMIT },
    );
    expect(mockTaskRepo.countByWorkspaceIdAsync).toHaveBeenCalledWith("workspace-1", {
      status: "TODO",
    });
  });

  it("should pass assigneeId filter to the repository", async () => {
    const task = createMockTask("123e4567-e89b-12d3-a456-426614174003", "DOING", "user-1");

    mockTaskRepo.findByWorkspaceIdAsync.mockResolvedValue([task]);
    mockTaskRepo.countByWorkspaceIdAsync.mockResolvedValue(1);

    const query = new GetTasksQuery("workspace-1", undefined, undefined, "user-1");
    const result = await handler.execute(query);

    expect(result.total).toBe(1);
    expect(result.tasks[0].id).toBe("123e4567-e89b-12d3-a456-426614174003");
    expect(mockTaskRepo.findByWorkspaceIdAsync).toHaveBeenCalledWith(
      "workspace-1",
      { assigneeId: "user-1" },
      { skip: 0, limit: TASK_LIST_DEFAULT_LIMIT },
    );
  });
});
