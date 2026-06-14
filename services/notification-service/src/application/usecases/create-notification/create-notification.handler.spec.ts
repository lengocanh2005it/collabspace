import { CreateNotificationHandler } from "./create-notification.handler";
import { CreateNotificationCommand } from "./create-notification.command";
import { INotificationRepository } from "../../../domain/repositories/INotificationRepository";
import { IProcessedEventRepository } from "../../../domain/repositories/IProcessedEventRepository";
import { NotificationType } from "../../../domain/value-objects/NotificationType";

describe("CreateNotificationHandler", () => {
  let handler: CreateNotificationHandler;
  let mockRepository: jest.Mocked<INotificationRepository>;
  let mockProcessedEventRepository: jest.Mocked<IProcessedEventRepository>;

  beforeEach(() => {
    mockRepository = {
      createAsync: jest.fn(),
      createBroadcastAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      findByRecipientIdAsync: jest.fn(),
      countUnreadByRecipientIdAsync: jest.fn(),
      updateAsync: jest.fn(),
      deleteAsync: jest.fn(),
    };
    mockProcessedEventRepository = {
      tryClaim: jest.fn().mockResolvedValue(true),
    };

    handler = new CreateNotificationHandler(
      mockRepository,
      mockProcessedEventRepository,
    );
  });

  it("should create notification and return ID", async () => {
    const command = new CreateNotificationCommand(
      "recipient-123",
      "actor-123",
      NotificationType.TASK_ASSIGNED,
      "New Task",
      "You have a new task",
      "task-123",
      "TASK",
      { workspaceId: "ws-123" },
    );

    mockRepository.createAsync.mockResolvedValue("new-notif-id");

    const result = await handler.execute(command);

    expect(result.notificationId).toBe("new-notif-id");
    expect(mockRepository.createAsync).toHaveBeenCalledTimes(1);
    const savedNotification = mockRepository.createAsync.mock.calls[0][0];
    expect(savedNotification.getRecipientId()).toBe("recipient-123");
    expect(savedNotification.getTitle()).toBe("New Task");
  });

  it("skips duplicate notifications when eventId was already processed", async () => {
    const command = new CreateNotificationCommand(
      "recipient-123",
      "actor-123",
      NotificationType.TASK_ASSIGNED,
      "New Task",
      "You have a new task",
      "task-123",
      "TASK",
      { workspaceId: "ws-123" },
      "evt-duplicate",
    );

    mockProcessedEventRepository.tryClaim.mockResolvedValue(false);

    const result = await handler.execute(command);

    expect(result.notificationId).toBe("");
    expect(mockRepository.createAsync).not.toHaveBeenCalled();
  });
});
