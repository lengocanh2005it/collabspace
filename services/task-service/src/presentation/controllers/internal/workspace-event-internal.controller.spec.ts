import type { RmqContext } from "@nestjs/microservices";
import { WorkspaceDeletionService } from "../../../application/services/workspace-deletion.service";
import { WorkspaceEventController } from "./workspace-event-internal.controller";

describe("WorkspaceEventController", () => {
  const deletionService = {
    deleteWorkspaceData: jest.fn(),
  };
  const ack = jest.fn();
  const message = {};
  const context = {
    getChannelRef: () => ({ ack }),
    getMessage: () => message,
  } as unknown as RmqContext;
  const controller = new WorkspaceEventController(
    deletionService as unknown as WorkspaceDeletionService,
  );

  beforeEach(() => jest.clearAllMocks());

  it("deletes workspace task data and acknowledges the event", async () => {
    deletionService.deleteWorkspaceData.mockResolvedValue(3);

    await controller.handleWorkspaceDeleted(
      {
        deletedById: "admin-1",
        eventId: "event-1",
        occurredAt: new Date().toISOString(),
        workspaceId: "workspace-1",
      },
      context,
    );

    expect(deletionService.deleteWorkspaceData).toHaveBeenCalledWith(
      "workspace-1",
    );
    expect(ack).toHaveBeenCalledWith(message);
  });

  it("leaves the message unacknowledged when cleanup fails", async () => {
    deletionService.deleteWorkspaceData.mockRejectedValue(new Error("down"));

    await controller.handleWorkspaceDeleted(
      {
        deletedById: "admin-1",
        eventId: "event-1",
        occurredAt: new Date().toISOString(),
        workspaceId: "workspace-1",
      },
      context,
    );

    expect(ack).not.toHaveBeenCalled();
  });
});
