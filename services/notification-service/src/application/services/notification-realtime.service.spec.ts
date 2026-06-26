import type { INotificationRepository } from "../../domain/repositories/INotificationRepository";
import type { NotificationCountCacheService } from "../../infrastructure/cache/notification-count-cache.service";
import { NotificationRealtimeService } from "./notification-realtime.service";

describe("NotificationRealtimeService", () => {
  let repository: jest.Mocked<INotificationRepository>;
  let countCache: jest.Mocked<NotificationCountCacheService>;

  beforeEach(() => {
    repository = {
      countByRecipientIdAsync: jest.fn(),
      countUnreadByRecipientIdAsync: jest.fn(),
      createAsync: jest.fn(),
      createBroadcastAsync: jest.fn(),
      createForEventAsync: jest.fn(),
      deleteAsync: jest.fn(),
      deleteOldNotificationsAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      findByRecipientIdAsync: jest.fn(),
      findByTypeAsync: jest.fn(),
      findUnreadByRecipientIdAsync: jest.fn(),
      markAllAsReadAsync: jest.fn(),
      updateAsync: jest.fn(),
    };
    countCache = {
      getUnreadCount: jest.fn(),
      invalidateUnreadCount: jest.fn(),
      setUnreadCount: jest.fn(),
    } as unknown as jest.Mocked<NotificationCountCacheService>;
  });

  it("sends a connected event and notification payload to local listeners", async () => {
    const service = new NotificationRealtimeService(null, repository, countCache);
    const events: Array<{ event: string; payload: unknown }> = [];

    const cleanup = service.addConnection("user-1", {
      close: jest.fn(),
      sendEvent: (event, payload) => {
        events.push({ event, payload });
      },
    });

    countCache.getUnreadCount.mockResolvedValue(3);

    await service.emitNotificationCreated("user-1", "notif-1");

    expect(events).toEqual([
      { event: "connected", payload: { type: "connected" } },
      {
        event: "notification.created",
        payload: {
          notificationId: "notif-1",
          type: "notification.created",
          unreadCount: 3,
        },
      },
    ]);

    cleanup();
  });

  it("hydrates unread count from repository when cache misses", async () => {
    const service = new NotificationRealtimeService(null, repository, countCache);
    const sendEvent = jest.fn();

    service.addConnection("user-1", {
      close: jest.fn(),
      sendEvent,
    });

    countCache.getUnreadCount.mockResolvedValue(null);
    repository.countUnreadByRecipientIdAsync.mockResolvedValue(5);

    await service.emitNotificationCreated("user-1", "notif-2");

    expect(repository.countUnreadByRecipientIdAsync).toHaveBeenCalledWith("user-1");
    expect(countCache.setUnreadCount).toHaveBeenCalledWith("user-1", 5);
    expect(sendEvent).toHaveBeenLastCalledWith("notification.created", {
      notificationId: "notif-2",
      type: "notification.created",
      unreadCount: 5,
    });
  });
});
