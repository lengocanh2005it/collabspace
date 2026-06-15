import type { CommandBus } from "@nestjs/cqrs";
import type { RmqContext } from "@nestjs/microservices";
import { WorkspaceInviteEventListenerController } from "./workspace-invite-event-listener.controller";

describe("WorkspaceInviteEventListenerController", () => {
  let controller: WorkspaceInviteEventListenerController;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockRmqContext: jest.Mocked<RmqContext>;
  let mockChannel: { ack: jest.Mock; nack: jest.Mock };
  let mockMessage: Record<string, never>;

  beforeEach(() => {
    mockCommandBus = {
      execute: jest.fn(),
    } as any;

    mockChannel = {
      ack: jest.fn(),
      nack: jest.fn(),
    };
    mockMessage = {};

    mockRmqContext = {
      getChannelRef: jest.fn().mockReturnValue(mockChannel),
      getMessage: jest.fn().mockReturnValue(mockMessage),
    } as any;

    controller = new WorkspaceInviteEventListenerController(mockCommandBus);
  });

  it("should process workspace_invited event and ack message", async () => {
    const payload = {
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

    expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
  });

  it("should ack and skip email-only workspace_invited events", async () => {
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
