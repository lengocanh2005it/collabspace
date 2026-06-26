import { CreateNotificationHandler } from "./create-notification.handler";
import { CreateNotificationCommand } from "./create-notification.command";
import type { INotificationRepository } from "../../../domain/repositories/INotificationRepository";
import type { IProcessedEventRepository } from "../../../domain/repositories/IProcessedEventRepository";
import { NotificationType } from "../../../domain/value-objects/NotificationType";
import type { NotificationCountCacheService } from "../../../infrastructure/cache/notification-count-cache.service";
import type { NotificationRealtimeService } from "../../services/notification-realtime.service";

const noopCountCache = {
  invalidateUnreadCount: jest.fn().mockResolvedValue(undefined),
} as unknown as NotificationCountCacheService;

const noopRealtime = {
  emitNotificationCreated: jest.fn().mockResolvedValue(undefined),
} as unknown as NotificationRealtimeService;

describe("CreateNotificationHandler", () => {
  let handler: CreateNotificationHandler;
  let mockRepository: jest.Mocked<INotificationRepository>;
  let mockProcessedEventRepository: jest.Mocked<IProcessedEventRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = {
      createAsync: jest.fn(),
      createForEventAsync: jest.fn(),
      createBroadcastAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      findByRecipientIdAsync: jest.fn(),
      countUnreadByRecipientIdAsync: jest.fn(),
      updateAsync: jest.fn(),
      deleteAsync: jest.fn(),
    };
    mockProcessedEventRepository = {
      markProcessed: jest.fn().mockResolvedValue(undefined),
      tryClaim: jest.fn().mockResolvedValue(true),
      releaseClaim: jest.fn().mockResolvedValue(undefined),
    };

    handler = new CreateNotificationHandler(
      mockRepository,
      mockProcessedEventRepository,
      noopCountCache,
      noopRealtime,
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
    expect(noopRealtime.emitNotificationCreated).toHaveBeenCalledWith(
      "recipient-123",
      "new-notif-id",
    );
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

  it("releases the idempotency claim when notification persistence fails", async () => {
    const command = new CreateNotificationCommand(
      "recipient-123",
      "actor-123",
      NotificationType.TASK_ASSIGNED,
      "New Task",
      "You have a new task",
      "task-123",
      "TASK",
      { workspaceId: "ws-123" },
      "evt-will-fail",
    );

    mockProcessedEventRepository.tryClaim.mockResolvedValue(true);
    mockRepository.createForEventAsync.mockRejectedValue(new Error("MongoDB write failed"));

    await expect(handler.execute(command)).rejects.toThrow("MongoDB write failed");

    expect(mockProcessedEventRepository.releaseClaim).toHaveBeenCalledWith("evt-will-fail");
  });

  it("marks eventId processed only after the notification is created", async () => {
    const command = new CreateNotificationCommand(
      "recipient-123",
      "actor-123",
      NotificationType.TASK_ASSIGNED,
      "New Task",
      "You have a new task",
      "task-123",
      "TASK",
      { workspaceId: "ws-123" },
      "evt-created",
    );

    mockRepository.createForEventAsync.mockResolvedValue({
      created: true,
      id: "new-notif-id",
    });

    const result = await handler.execute(command);

    expect(result.notificationId).toBe("new-notif-id");
    expect(mockRepository.createForEventAsync).toHaveBeenCalledWith(
      expect.any(Object),
      "evt-created",
    );
    expect(mockProcessedEventRepository.markProcessed).toHaveBeenCalledWith("evt-created");
  });

  it("does not call releaseClaim when there is no eventId", async () => {
    const command = new CreateNotificationCommand(
      "recipient-123",
      "actor-123",
      NotificationType.TASK_ASSIGNED,
      "New Task",
      "You have a new task",
      "task-123",
      "TASK",
      { workspaceId: "ws-123" },
      // no eventId
    );

    mockRepository.createAsync.mockRejectedValue(new Error("MongoDB write failed"));

    await expect(handler.execute(command)).rejects.toThrow("MongoDB write failed");

    expect(mockProcessedEventRepository.releaseClaim).not.toHaveBeenCalled();
  });
});
