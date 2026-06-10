import { GetNotificationsHandler } from "./get-notifications.handler";
import { GetNotificationsQuery } from "./get-notifications.query";
import { INotificationRepository } from "../../../domain/repositories/INotificationRepository";
import { Notification } from "../../../domain/entities/Notification";
import { NotificationType } from "../../../domain/value-objects/NotificationType";
import { NotificationStatus } from "../../../domain/value-objects/NotificationStatus";

describe("GetNotificationsHandler", () => {
  let handler: GetNotificationsHandler;
  let mockRepository: jest.Mocked<INotificationRepository>;

  beforeEach(() => {
    mockRepository = {
      createAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      findByRecipientIdAsync: jest.fn(),
      countUnreadByRecipientIdAsync: jest.fn(),
      updateAsync: jest.fn(),
      deleteAsync: jest.fn(),
    };

    handler = new GetNotificationsHandler(mockRepository);
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

  it("should return paginated notifications and unread count", async () => {
    const query = new GetNotificationsQuery("recipient-123", 0, 10);
    const mockNotifications = [
      createMockNotification("notif-1"),
      createMockNotification("notif-2"),
    ];

    mockRepository.findByRecipientIdAsync.mockResolvedValue(mockNotifications);
    mockRepository.countUnreadByRecipientIdAsync.mockResolvedValue(5);

    const result = await handler.execute(query);

    expect(result.total).toBe(2);
    expect(result.unreadCount).toBe(5);
    expect(result.notifications).toHaveLength(2);
    expect(result.notifications[0].id).toBe("notif-1");
    expect(result.notifications[0].actor.name).toBe("John Doe");
    expect(mockRepository.findByRecipientIdAsync).toHaveBeenCalledWith(
      "recipient-123",
      { skip: 0, limit: 10 },
    );
  });
});
