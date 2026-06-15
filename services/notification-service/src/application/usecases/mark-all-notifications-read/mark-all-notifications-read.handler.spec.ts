import { MarkAllNotificationsReadCommand } from "./mark-all-notifications-read.command";
import { MarkAllNotificationsReadHandler } from "./mark-all-notifications-read.handler";
import type { INotificationRepository } from "../../../domain/repositories/INotificationRepository";
import type { NotificationCountCacheService } from "../../../infrastructure/cache/notification-count-cache.service";

const noopCountCache = {
  invalidateUnreadCount: jest.fn().mockResolvedValue(undefined),
} as unknown as NotificationCountCacheService;

describe("MarkAllNotificationsReadHandler", () => {
  it("returns the number of updated notifications", async () => {
    const repository = {
      markAllAsReadAsync: jest.fn().mockResolvedValue(4),
    } as unknown as jest.Mocked<INotificationRepository>;
    const handler = new MarkAllNotificationsReadHandler(repository, noopCountCache);

    await expect(handler.execute(new MarkAllNotificationsReadCommand("user-1"))).resolves.toEqual({
      updatedCount: 4,
    });
    expect(repository.markAllAsReadAsync).toHaveBeenCalledWith("user-1");
  });
});
