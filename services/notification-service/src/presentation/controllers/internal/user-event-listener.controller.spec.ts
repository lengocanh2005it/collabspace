import type { CommandBus } from "@nestjs/cqrs";
import type { RmqContext } from "@nestjs/microservices";
import { UserEventListenerController } from "./user-event-listener.controller";
import type { MetricsService } from "../../../metrics/metrics.service";

describe("UserEventListenerController", () => {
  it("syncs a registered user and acknowledges the message", async () => {
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const metrics = { recordReplicaSyncLag: jest.fn() };
    const channel = { ack: jest.fn(), nack: jest.fn(), publish: jest.fn() };
    const message = { properties: { headers: {} } };
    const context = {
      getChannelRef: jest.fn().mockReturnValue(channel),
      getMessage: jest.fn().mockReturnValue(message),
    } as unknown as RmqContext;
    const controller = new UserEventListenerController(
      commandBus as unknown as CommandBus,
      metrics as unknown as MetricsService,
    );

    await controller.handleUserRegistered(
      {
        eventId: "event-1",
        occurredAt: new Date().toISOString(),
        userId: "user-1",
        email: "user@example.com",
        fullName: "User One",
        username: "user.one",
      },
      context,
    );

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(metrics.recordReplicaSyncLag).toHaveBeenCalled();
  });
});
