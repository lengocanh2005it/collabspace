import { Notification } from "./Notification";
import { NotificationType } from "../value-objects/NotificationType";
import { NotificationStatus } from "../value-objects/NotificationStatus";

describe("Notification Entity", () => {
  const validData = {
    recipientId: "recipient-123",
    actorId: "actor-123",
    type: NotificationType.TASK_ASSIGNED,
    title: "New Task Assigned",
    message: "You have been assigned to a new task",
    targetId: "task-123",
    targetType: "TASK",
    metadata: { actorName: "John Doe" },
  };

  it("should create a valid notification", () => {
    const notification = Notification.create(
      validData.recipientId,
      validData.actorId,
      validData.type,
      validData.title,
      validData.message,
      validData.targetId,
      validData.targetType,
      validData.metadata,
    );

    expect(notification.getId()).toBeDefined();
    expect(notification.getRecipientId()).toBe(validData.recipientId);
    expect(notification.getStatus()).toBe(NotificationStatus.UNREAD);
    expect(notification.getCreatedAt()).toBeDefined();
  });

  it("should throw error if required fields are missing", () => {
    expect(() =>
      Notification.create(
        "",
        "actor",
        NotificationType.TASK_ASSIGNED,
        "title",
        "msg",
        "target",
        "type",
      ),
    ).toThrow("Recipient ID is required");
    expect(() =>
      Notification.create(
        "recipient",
        "",
        NotificationType.TASK_ASSIGNED,
        "title",
        "msg",
        "target",
        "type",
      ),
    ).toThrow("Actor ID is required");
  });

  it("should mark as read", () => {
    const notification = Notification.create(
      validData.recipientId,
      validData.actorId,
      validData.type,
      validData.title,
      validData.message,
      validData.targetId,
      validData.targetType,
    );

    notification.markAsRead();
    expect(notification.getStatus()).toBe(NotificationStatus.READ);
    expect(notification.isRead()).toBe(true);
    expect(notification.isUnread()).toBe(false);
  });

  it("should throw error when marking already read notification as read", () => {
    const notification = Notification.create(
      validData.recipientId,
      validData.actorId,
      validData.type,
      validData.title,
      validData.message,
      validData.targetId,
      validData.targetType,
    );

    notification.markAsRead();
    expect(() => notification.markAsRead()).toThrow(
      "Notification is already read",
    );
  });

  it("should restore from database state", () => {
    const id = "notif-123";
    const createdAt = new Date("2023-01-01");
    const updatedAt = new Date("2023-01-02");

    const notification = Notification.restore(
      id,
      validData.recipientId,
      validData.actorId,
      validData.type,
      validData.title,
      validData.message,
      validData.targetId,
      validData.targetType,
      NotificationStatus.READ,
      validData.metadata,
      createdAt,
      updatedAt,
    );

    expect(notification.getId()).toBe(id);
    expect(notification.getStatus()).toBe(NotificationStatus.READ);
    expect(notification.getCreatedAt()).toEqual(createdAt);
    expect(notification.getUpdatedAt()).toEqual(updatedAt);
  });
});
