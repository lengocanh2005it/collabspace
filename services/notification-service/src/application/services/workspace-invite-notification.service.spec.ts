import type { CommandBus } from "@nestjs/cqrs";
import { NotificationType } from "../../domain/value-objects/NotificationType";
import type { UserReplicaLookupService } from "./user-replica-lookup.service";
import { WorkspaceInviteNotificationService } from "./workspace-invite-notification.service";

describe("WorkspaceInviteNotificationService", () => {
  let service: WorkspaceInviteNotificationService;
  let mockCommandBus: jest.Mocked<Pick<CommandBus, "execute">>;
  let mockUserReplicaLookup: jest.Mocked<
    Pick<UserReplicaLookupService, "findActiveUserIdByEmailAsync">
  >;

  beforeEach(() => {
    mockCommandBus = {
      execute: jest.fn(),
    };
    mockUserReplicaLookup = {
      findActiveUserIdByEmailAsync: jest.fn(),
    };

    service = new WorkspaceInviteNotificationService(
      mockCommandBus as CommandBus,
      mockUserReplicaLookup as UserReplicaLookupService,
    );
  });

  it("returns duplicate when eventId already processed", async () => {
    mockCommandBus.execute.mockResolvedValue({
      notificationId: "",
      message: "Notification already processed for event",
    });

    const result = await service.processWorkspaceInvited(
      {
        eventId: "evt-dup",
        workspaceId: "ws-1",
        invitedById: "user-1",
        recipientId: "user-2",
      },
      "kafka",
    );

    expect(result).toBe("duplicate");
  });

  it("resolves inviteEmail before creating notification", async () => {
    mockUserReplicaLookup.findActiveUserIdByEmailAsync.mockResolvedValue("user-2");
    mockCommandBus.execute.mockResolvedValue({
      notificationId: "noti-1",
      message: "Notification created successfully",
    });

    const result = await service.processWorkspaceInvited(
      {
        eventId: "evt-1",
        workspaceId: "ws-1",
        invitedById: "user-1",
        inviteEmail: "member@example.com",
      },
      "kafka",
    );

    expect(result).toBe("created");
    expect(mockCommandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-2",
        type: NotificationType.WORKSPACE_INVITED,
        eventId: "evt-1",
      }),
    );
  });

  it("prepareWorkspaceInvitedCommand returns null without recipient", async () => {
    const command = await service.prepareWorkspaceInvitedCommand({
      workspaceId: "ws-1",
      invitedById: "user-1",
      inviteEmail: "unknown@example.com",
    });

    expect(command).toBeNull();
  });
});
