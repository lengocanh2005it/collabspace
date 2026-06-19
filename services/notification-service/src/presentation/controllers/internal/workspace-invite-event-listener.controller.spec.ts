import type { CommandBus } from "@nestjs/cqrs";
import type { RmqContext } from "@nestjs/microservices";
import type { WorkspaceInviteNotificationService } from "../../../application/services/workspace-invite-notification.service";
import { NotificationType } from "../../../domain/value-objects/NotificationType";
import { CreateNotificationCommand } from "../../../application/usecases/create-notification/create-notification.command";
import { WorkspaceInviteEventListenerController } from "./workspace-invite-event-listener.controller";

describe("WorkspaceInviteEventListenerController", () => {
  let controller: WorkspaceInviteEventListenerController;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockWorkspaceInviteNotification: jest.Mocked<
    Pick<WorkspaceInviteNotificationService, "prepareWorkspaceInvitedCommand">
  >;
  let mockRmqContext: jest.Mocked<RmqContext>;
  let mockChannel: { ack: jest.Mock; nack: jest.Mock };
  let mockMessage: Record<string, never>;

  const sampleCommand = new CreateNotificationCommand(
    "user-123",
    "user-456",
    NotificationType.WORKSPACE_INVITED,
    "Lời mời vào workspace",
    'Alice đã mời bạn vào workspace "Core Team"',
    "workspace-123",
    "WORKSPACE",
    { workspaceName: "Core Team" },
    "evt-1",
  );

  beforeEach(() => {
    mockCommandBus = {
      execute: jest.fn().mockResolvedValue({
        notificationId: "noti-1",
        message: "Notification created successfully",
      }),
    } as unknown as jest.Mocked<CommandBus>;

    mockWorkspaceInviteNotification = {
      prepareWorkspaceInvitedCommand: jest.fn().mockResolvedValue(sampleCommand),
    };

    mockChannel = {
      ack: jest.fn(),
      nack: jest.fn(),
    };
    mockMessage = {};

    mockRmqContext = {
      getChannelRef: jest.fn().mockReturnValue(mockChannel),
      getMessage: jest.fn().mockReturnValue(mockMessage),
    } as unknown as jest.Mocked<RmqContext>;

    controller = new WorkspaceInviteEventListenerController(
      mockCommandBus,
      mockWorkspaceInviteNotification as WorkspaceInviteNotificationService,
    );
  });

  it("should process workspace_invited event and ack message", async () => {
    const payload = {
      eventId: "evt-1",
      workspaceId: "workspace-123",
      workspaceName: "Core Team",
      recipientId: "user-123",
      invitedById: "user-456",
      invitedByName: "Alice",
      invitedByAvatarUrl: "https://example.com/avatar.png",
      role: "member",
      inviteEmail: "user@example.com",
    };

    await controller.handleWorkspaceInvited(payload, mockRmqContext);

    expect(mockWorkspaceInviteNotification.prepareWorkspaceInvitedCommand).toHaveBeenCalledWith(
      payload,
    );
    expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
  });

  it("should ack and skip when prepare returns null", async () => {
    mockWorkspaceInviteNotification.prepareWorkspaceInvitedCommand.mockResolvedValue(null);

    const payload = {
      workspaceId: "workspace-123",
      workspaceName: "Core Team",
      invitedById: "user-456",
      inviteEmail: "user@example.com",
    };

    await controller.handleWorkspaceInvited(payload, mockRmqContext);

    expect(mockCommandBus.execute).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });
});
