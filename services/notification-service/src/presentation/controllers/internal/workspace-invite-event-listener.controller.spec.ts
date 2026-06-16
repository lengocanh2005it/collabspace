import type { CommandBus } from "@nestjs/cqrs";
import type { RmqContext } from "@nestjs/microservices";
import type { UserReplicaLookupService } from "../../../application/services/user-replica-lookup.service";
import { WorkspaceInviteEventListenerController } from "./workspace-invite-event-listener.controller";

describe("WorkspaceInviteEventListenerController", () => {
  let controller: WorkspaceInviteEventListenerController;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockUserReplicaLookup: jest.Mocked<Pick<UserReplicaLookupService, "findActiveUserIdByEmailAsync">>;
  let mockRmqContext: jest.Mocked<RmqContext>;
  let mockChannel: { ack: jest.Mock; nack: jest.Mock };
  let mockMessage: Record<string, never>;

  beforeEach(() => {
    mockCommandBus = {
      execute: jest.fn(),
    } as any;

    mockUserReplicaLookup = {
      findActiveUserIdByEmailAsync: jest.fn(),
    };

    mockChannel = {
      ack: jest.fn(),
      nack: jest.fn(),
    };
    mockMessage = {};

    mockRmqContext = {
      getChannelRef: jest.fn().mockReturnValue(mockChannel),
      getMessage: jest.fn().mockReturnValue(mockMessage),
    } as any;

    controller = new WorkspaceInviteEventListenerController(
      mockCommandBus,
      mockUserReplicaLookup as UserReplicaLookupService,
    );
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

    expect(mockUserReplicaLookup.findActiveUserIdByEmailAsync).not.toHaveBeenCalled();
    expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
  });

  it("should resolve inviteEmail to recipientId from user replica and create notification", async () => {
    mockUserReplicaLookup.findActiveUserIdByEmailAsync.mockResolvedValue("user-123");

    const payload = {
      workspaceId: "workspace-123",
      workspaceName: "Core Team",
      invitedById: "user-456",
      inviteEmail: "user@example.com",
    };

    await controller.handleWorkspaceInvited(payload, mockRmqContext);

    expect(mockUserReplicaLookup.findActiveUserIdByEmailAsync).toHaveBeenCalledWith(
      "user@example.com",
    );
    expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
  });

  it("should ack and skip workspace_invited events when email cannot be resolved", async () => {
    mockUserReplicaLookup.findActiveUserIdByEmailAsync.mockResolvedValue(null);

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
