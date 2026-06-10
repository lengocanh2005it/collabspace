import { MarkNotificationReadHandler } from "./mark-notification-read.handler";
import { MarkNotificationReadCommand } from "./mark-notification-read.command";
import { INotificationRepository } from "../../../domain/repositories/INotificationRepository";
import { Notification } from "../../../domain/entities/Notification";
import { NotificationType } from "../../../domain/value-objects/NotificationType";

describe("MarkNotificationReadHandler", () => {
  let handler: MarkNotificationReadHandler;
  let mockRepo: jest.Mocked<INotificationRepository>;

  beforeEach(() => {
    mockRepo = {
      createAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      findByRecipientIdAsync: jest.fn(),
      findUnreadByRecipientIdAsync: jest.fn(),
      countUnreadByRecipientIdAsync: jest.fn(),
      updateAsync: jest.fn(),
      deleteAsync: jest.fn(),
      markAllAsReadAsync: jest.fn(),
      findByTypeAsync: jest.fn(),
      deleteOldNotificationsAsync: jest.fn(),
    };

    handler = new MarkNotificationReadHandler(mockRepo);
  });

  it("marks an unread notification as read", async () => {
    const notification = Notification.create(
      "user-2",
      "user-1",
      NotificationType.TASK_ASSIGNED,
      "Title",
      "Message",
      "task-1",
      "TASK",
    );

    mockRepo.findByIdAsync.mockResolvedValue(notification);
    mockRepo.updateAsync.mockResolvedValue(true);

    await handler.execute(
      new MarkNotificationReadCommand(notification.getId(), "user-2"),
    );

    expect(notification.isRead()).toBe(true);
    expect(mockRepo.updateAsync).toHaveBeenCalledWith(notification);
  });
});
