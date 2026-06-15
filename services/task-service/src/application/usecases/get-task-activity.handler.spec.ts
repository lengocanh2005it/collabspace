import { GetTaskActivityHandler } from "./get-task-activity.handler";
import { GetTaskActivityQuery } from "../queries/get-task-activity.query";
import type { ITaskActivityRepository } from "../ports/ITaskActivityRepository";

describe("GetTaskActivityHandler", () => {
  let handler: GetTaskActivityHandler;
  let mockTaskActivityRepository: jest.Mocked<ITaskActivityRepository>;

  beforeEach(() => {
    mockTaskActivityRepository = {
      appendFromEventsAsync: jest.fn(),
      appendFromCommentAsync: jest.fn(),
      findByTaskIdAsync: jest.fn(),
      countByTaskIdAsync: jest.fn(),
    };

    handler = new GetTaskActivityHandler(mockTaskActivityRepository);
  });

  it("returns paginated activity from the read model", async () => {
    const items = [
      {
        id: "event-1",
        type: "task_created" as const,
        actorId: "creator-1",
        actorName: "Creator",
        actorAvatarUrl: null,
        summary: 'Created task "Demo"',
        meta: { title: "Demo", status: "TODO" },
        occurredAt: "2026-01-15T08:00:00.000Z",
      },
    ];

    mockTaskActivityRepository.findByTaskIdAsync.mockResolvedValue(items);
    mockTaskActivityRepository.countByTaskIdAsync.mockResolvedValue(3);

    const result = await handler.execute(new GetTaskActivityQuery("task-1", 10, 5));

    expect(result.items).toEqual(items);
    expect(result.total).toBe(3);
    expect(mockTaskActivityRepository.findByTaskIdAsync).toHaveBeenCalledWith("task-1", {
      offset: 5,
      limit: 10,
    });
    expect(mockTaskActivityRepository.countByTaskIdAsync).toHaveBeenCalledWith("task-1");
  });
});
