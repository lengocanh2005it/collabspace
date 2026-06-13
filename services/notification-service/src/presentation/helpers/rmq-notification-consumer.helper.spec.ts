import type { Logger } from "@nestjs/common";
import type { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";
import { consumeNotificationEvent } from "./rmq-notification-consumer.helper";
import { CreateNotificationCommand } from "../../application/usecases/create-notification/create-notification.command";
import { NotificationType } from "../../domain/value-objects/NotificationType";

describe("consumeNotificationEvent", () => {
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockChannel: jest.Mocked<Channel>;
  let mockLogger: jest.Mocked<Logger>;
  let message: ConsumeMessage;

  beforeEach(() => {
    mockCommandBus = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CommandBus>;

    mockChannel = {
      ack: jest.fn(),
      nack: jest.fn(),
      publish: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<Channel>;

    mockLogger = {
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    message = {
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
    } as ConsumeMessage;
  });

  const command = new CreateNotificationCommand(
    "recipient-1",
    "actor-1",
    NotificationType.TASK_ASSIGNED,
    "Task assigned",
    "Assigned to you",
    "task-1",
    "TASK",
    {},
    "event-1",
  );

  it("acks the message when processing succeeds", async () => {
    await consumeNotificationEvent(
      {
        commandBus: mockCommandBus,
        channel: mockChannel,
        message,
        logger: mockLogger,
        eventLabel: "task_assigned",
      },
      command,
    );

    expect(mockChannel.ack).toHaveBeenCalledWith(message);
  });

  it("republishes with x-retry-count before max retries are exhausted", async () => {
    mockCommandBus.execute.mockRejectedValue(new Error("DB Error"));

    await consumeNotificationEvent(
      {
        commandBus: mockCommandBus,
        channel: mockChannel,
        message,
        logger: mockLogger,
        eventLabel: "task_assigned",
        maxRetries: 3,
      },
      command,
    );

    expect(mockChannel.ack).toHaveBeenCalledWith(message);
    expect(mockChannel.publish).toHaveBeenCalledWith(
      "",
      "notification-service",
      message.content,
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-retry-count": 1,
        }),
      }),
    );
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });

  it("nacks without requeue when max retries are exhausted", async () => {
    mockCommandBus.execute.mockRejectedValue(new Error("DB Error"));
    message.properties.headers = { "x-retry-count": 3 };

    await consumeNotificationEvent(
      {
        commandBus: mockCommandBus,
        channel: mockChannel,
        message,
        logger: mockLogger,
        eventLabel: "task_assigned",
        maxRetries: 3,
      },
      command,
    );

    expect(mockChannel.nack).toHaveBeenCalledWith(message, false, false);
    expect(mockChannel.publish).not.toHaveBeenCalled();
  });
});
