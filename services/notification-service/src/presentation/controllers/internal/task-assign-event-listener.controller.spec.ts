import { TaskEventController } from "./task-assign-event-listener.controller";
import { CommandBus } from "@nestjs/cqrs";
import { RmqContext } from "@nestjs/microservices";

describe("TaskEventController", () => {
  let controller: TaskEventController;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockRmqContext: jest.Mocked<RmqContext>;
  let mockChannel: any;
  let mockMessage: any;

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

    controller = new TaskEventController(mockCommandBus);
  });

  it("should process task_assigned event and ack message", async () => {
    const payload = {
      taskId: "task-123",
      taskTitle: "Task Title",
      recipientId: "recipient-123",
      actorId: "actor-123",
      actorName: "John Doe",
      actorAvatarUrl: "url",
      assignedAt: new Date().toISOString(),
      workspaceId: "ws-123",
    };

    await controller.handleTaskAssignedEvent(payload, mockRmqContext);

    expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
  });
});
