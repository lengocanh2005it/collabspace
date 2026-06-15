import { Notification } from "../../domain/entities/Notification";
import { NotificationType } from "../../domain/value-objects/NotificationType";
import { BroadcastJobService } from "./broadcast-job.service";

describe("BroadcastJobService", () => {
  const jobModel = {
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  const notificationRepository = {
    createBroadcastAsync: jest.fn(),
  };
  const userRepository = {
    listActiveUserIdsAsync: jest.fn(),
  };
  const service = new BroadcastJobService(
    jobModel as never,
    notificationRepository as never,
    userRepository as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("creates notifications for each recipient batch", async () => {
    const job = {
      actorId: "admin-1",
      body: "Maintenance tonight",
      cursor: 0,
      id: "job-1",
      save: jest.fn().mockResolvedValue(undefined),
      title: "Notice",
    };
    jobModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(job),
    });
    userRepository.listActiveUserIdsAsync.mockResolvedValue(["user-1", "user-2"]);
    notificationRepository.createBroadcastAsync.mockResolvedValue(undefined);

    await service.processNext();

    expect(notificationRepository.createBroadcastAsync).toHaveBeenCalledTimes(2);
    expect(notificationRepository.createBroadcastAsync).toHaveBeenCalledWith(
      expect.any(Notification),
      "job-1:user-1",
    );
    expect(notificationRepository.createBroadcastAsync.mock.calls[0][0].getType()).toBe(
      NotificationType.SYSTEM_BROADCAST,
    );
    expect(job.status).toBe("completed");
  });
});
