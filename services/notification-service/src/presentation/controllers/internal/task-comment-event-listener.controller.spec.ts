import { CommentEventListenerController } from "./task-comment-event-listener.controller";
import { CommandBus } from "@nestjs/cqrs";
import { RmqContext } from "@nestjs/microservices";

describe("CommentEventListenerController", () => {
  let controller: CommentEventListenerController;
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
      publish: jest.fn().mockReturnValue(true),
    };
    mockMessage = {
      content: Buffer.from("{}"),
      fields: {
        deliveryTag: 1,
        exchange: "",
        routingKey: "notification-service",
        redelivered: false,
      },
      properties: {
        headers: {},
      },
    };

    mockRmqContext = {
      getChannelRef: jest.fn().mockReturnValue(mockChannel),
      getMessage: jest.fn().mockReturnValue(mockMessage),
    } as any;

    controller = new CommentEventListenerController(mockCommandBus);
  });

  it("should process comment_created event and ack message", async () => {
    const payload = {
      taskId: "task-123",
      taskTitle: "Task Title",
      recipientId: "recipient-123",
      actorId: "actor-123",
      actorName: "John Doe",
      actorAvatarUrl: "url",
      commentId: "comment-123",
      commentPreview: "Nice task!",
      createdAt: new Date().toISOString(),
    };

    await controller.handleTaskCommented(payload, mockRmqContext);

    expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
  });

  it("should log error but not crash if processing fails", async () => {
    const payload = {} as any;
    mockCommandBus.execute.mockRejectedValue(new Error("DB Error"));

    await expect(
      controller.handleTaskCommented(payload, mockRmqContext),
    ).resolves.not.toThrow();
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    expect(mockChannel.publish).toHaveBeenCalled();
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });
});
