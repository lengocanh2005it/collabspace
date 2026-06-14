import { CommandBus } from "@nestjs/cqrs";
import { RmqContext } from "@nestjs/microservices";
import { CommentMentionEventListenerController } from "./comment-mention-event-listener.controller";

describe("CommentMentionEventListenerController", () => {
  it("dispatches and acknowledges mention events", async () => {
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const channel = { ack: jest.fn(), nack: jest.fn(), publish: jest.fn() };
    const message = { properties: { headers: {} } };
    const context = {
      getChannelRef: jest.fn().mockReturnValue(channel),
      getMessage: jest.fn().mockReturnValue(message),
    } as unknown as RmqContext;
    const controller = new CommentMentionEventListenerController(
      commandBus as unknown as CommandBus,
    );

    await controller.handleCommentMentioned(
      {
        eventId: "event-1",
        occurredAt: new Date().toISOString(),
        taskId: "task-1",
        taskTitle: "Task",
        commentId: "comment-1",
        commentPreview: "hello",
        actorId: "actor-1",
        actorName: "Actor",
        recipientId: "user-1",
      },
      context,
    );

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(channel.ack).toHaveBeenCalledWith(message);
  });
});
