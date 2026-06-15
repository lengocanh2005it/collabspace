import { BadRequestException } from "@nestjs/common";
import type { BroadcastJobService } from "../../application/services/broadcast-job.service";
import { NotificationAdminController } from "./notification-admin.controller";

describe("NotificationAdminController", () => {
  const jobs = {
    enqueue: jest.fn(),
  } as unknown as jest.Mocked<BroadcastJobService>;
  const controller = new NotificationAdminController(jobs);
  const body = {
    body: "System maintenance",
    target: "all" as const,
    title: "Notice",
    type: "system_broadcast" as const,
  };

  beforeEach(() => jest.clearAllMocks());

  it("requires an idempotency key", async () => {
    await expect(controller.broadcast(body, "admin-1", undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("enqueues an admin broadcast", async () => {
    jobs.enqueue.mockResolvedValue({ id: "job-1", status: "pending" } as never);

    await controller.broadcast(body, "admin-1", " key-1 ");

    expect(jobs.enqueue).toHaveBeenCalledWith({
      actorId: "admin-1",
      body: "System maintenance",
      idempotencyKey: "key-1",
      title: "Notice",
    });
  });
});
