import { GetNotificationsHandler } from "./get-notifications.handler";
import { GetNotificationsQuery } from "./get-notifications.query";
import { INotificationRepository } from "../../../domain/repositories/INotificationRepository";
import { Notification } from "../../../domain/entities/Notification";
import { NotificationType } from "../../../domain/value-objects/NotificationType";
import { NotificationStatus } from "../../../domain/value-objects/NotificationStatus";
import { UserReplicaLookupService } from "../../services/user-replica-lookup.service";

describe("GetNotificationsHandler", () => {
  let handler: GetNotificationsHandler;
  let mockRepository: jest.Mocked<INotificationRepository>;
  let mockUserReplicaLookup: jest.Mocked<
    Pick<UserReplicaLookupService, "findActiveMapByIdsAsync">
  >;

  beforeEach(() => {
    mockRepository = {
      createAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      findByRecipientIdAsync: jest.fn(),
      countByRecipientIdAsync: jest.fn(),
      countUnreadByRecipientIdAsync: jest.fn(),
      updateAsync: jest.fn(),
      deleteAsync: jest.fn(),
    };

    mockUserReplicaLookup = {
      findActiveMapByIdsAsync: jest.fn().mockResolvedValue(
        new Map([
          [
            "actor-123",
            {
              userId: "actor-123",
              email: "actor@test.com",
              username: "actor.user",
              fullName: "Actor User",
              displayName: "Actor",
              avatarUrl: "https://cdn.example.com/a.png",
              isActive: true,
            },
          ],
        ]),
      ),
    };

    handler = new GetNotificationsHandler(
      mockRepository,
      mockUserReplicaLookup as UserReplicaLookupService,
    );
  });

  const createMockNotification = (id: string) => {
    return Notification.restore(
      id,
      "recipient-123",
      "actor-123",
      NotificationType.TASK_ASSIGNED,
      "Title " + id,
      "Message " + id,
      "task-123",
      "TASK",
      NotificationStatus.UNREAD,
      { actorName: "John Doe" },
      new Date(),
      new Date(),
    );
  };

  it("should return paginated notifications enriched from user replica", async () => {
    const query = new GetNotificationsQuery("recipient-123", 0, 10);
    const mockNotifications = [
      createMockNotification("notif-1"),
      createMockNotification("notif-2"),
    ];

    mockRepository.findByRecipientIdAsync.mockResolvedValue(mockNotifications);
    mockRepository.countByRecipientIdAsync.mockResolvedValue(42);
    mockRepository.countUnreadByRecipientIdAsync.mockResolvedValue(5);

    const result = await handler.execute(query);

    expect(result.total).toBe(42);
    expect(result.unreadCount).toBe(5);
    expect(result.notifications[0].actor.name).toBe("Actor");
    expect(result.notifications[0].actor.avatarUrl).toBe(
      "https://cdn.example.com/a.png",
    );
  });
});
