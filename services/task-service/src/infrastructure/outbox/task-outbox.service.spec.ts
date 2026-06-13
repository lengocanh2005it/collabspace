import { TaskOutboxService } from "./task-outbox.service";
import type { Model } from "mongoose";
import type { TaskOutboxEventDocument } from "./task-outbox.schema";

describe("TaskOutboxService.claimPendingBatch", () => {
  let service: TaskOutboxService;
  let mockOutboxModel: jest.Mocked<Model<TaskOutboxEventDocument>>;

  beforeEach(() => {
    mockOutboxModel = {
      find: jest.fn(),
      bulkWrite: jest.fn(),
    } as unknown as jest.Mocked<Model<TaskOutboxEventDocument>>;

    service = new TaskOutboxService(mockOutboxModel);
  });

  it("claims pending events in one bulk write instead of per-row updates", async () => {
    const candidateId = "outbox-1";
    const claimTime = new Date("2026-01-15T10:00:00.000Z");
    const claimedEvent = {
      _id: candidateId,
      eventType: "task.task_assigned",
      payload: { taskId: "task-1" },
      attemptCount: 1,
      claimedAt: claimTime,
    } as TaskOutboxEventDocument;

    const leanExec = jest.fn().mockResolvedValue([{ _id: candidateId }]);
    const claimedExec = jest.fn().mockResolvedValue([claimedEvent]);

    mockOutboxModel.find
      .mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: leanExec,
              }),
            }),
          }),
        }),
      } as never)
      .mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          exec: claimedExec,
        }),
      } as never);

    mockOutboxModel.bulkWrite.mockResolvedValue({
      modifiedCount: 1,
    } as never);

    const result = await service.claimPendingBatch(25);

    expect(mockOutboxModel.find).toHaveBeenCalledTimes(2);
    expect(mockOutboxModel.bulkWrite).toHaveBeenCalledTimes(1);
    expect(mockOutboxModel.bulkWrite).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: expect.objectContaining({
              _id: candidateId,
              claimedAt: null,
            }),
          }),
        }),
      ],
      { ordered: false },
    );
    expect(result).toEqual([claimedEvent]);
  });

  it("returns an empty batch when no pending events exist", async () => {
    mockOutboxModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    } as never);

    const result = await service.claimPendingBatch();

    expect(result).toEqual([]);
    expect(mockOutboxModel.bulkWrite).not.toHaveBeenCalled();
  });
});
