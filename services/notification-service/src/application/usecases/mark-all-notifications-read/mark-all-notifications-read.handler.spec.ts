import { MarkAllNotificationsReadCommand } from "./mark-all-notifications-read.command";
import { MarkAllNotificationsReadHandler } from "./mark-all-notifications-read.handler";
import type { INotificationRepository } from "../../../domain/repositories/INotificationRepository";

describe("MarkAllNotificationsReadHandler", () => {
  it("returns the number of updated notifications", async () => {
    const repository = {
      markAllAsReadAsync: jest.fn().mockResolvedValue(4),
    } as unknown as jest.Mocked<INotificationRepository>;
    const handler = new MarkAllNotificationsReadHandler(repository);

    await expect(
      handler.execute(new MarkAllNotificationsReadCommand("user-1")),
    ).resolves.toEqual({ updatedCount: 4 });
    expect(repository.markAllAsReadAsync).toHaveBeenCalledWith("user-1");
  });
});
