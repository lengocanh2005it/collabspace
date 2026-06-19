import type { CommandBus, QueryBus } from "@nestjs/cqrs";
import type { Response } from "express";
import type { NotificationHealthService } from "../../health/notification-health.service";
import type { MetricsService } from "../../metrics/metrics.service";
import type { AuthenticatedRequest } from "../http/authenticated-request";
import type { NotificationRealtimeService } from "../../application/services/notification-realtime.service";
import { NotificationsController } from "./notifications.controller";

describe("NotificationsController", () => {
  const queryBus = {} as QueryBus;
  const commandBus = {} as CommandBus;
  const notificationHealthService = {} as NotificationHealthService;
  const metricsService = {} as MetricsService;
  const notificationRealtime = {
    addConnection: jest.fn(),
  } as unknown as jest.Mocked<NotificationRealtimeService>;

  const controller = new NotificationsController(
    queryBus,
    commandBus,
    notificationHealthService,
    metricsService,
    notificationRealtime,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens an authenticated SSE stream with headers and cleanup", () => {
    const cleanup = jest.fn();
    notificationRealtime.addConnection.mockReturnValue(cleanup);

    const requestHandlers = new Map<string, () => void>();
    const responseHandlers = new Map<string, () => void>();
    const request = {
      on: jest.fn((event: string, handler: () => void) => {
        requestHandlers.set(event, handler);
      }),
      user: { id: "user-1" },
    } as unknown as AuthenticatedRequest;
    const response = {
      end: jest.fn(),
      flushHeaders: jest.fn(),
      on: jest.fn((event: string, handler: () => void) => {
        responseHandlers.set(event, handler);
      }),
      setHeader: jest.fn(),
      writableEnded: false,
      write: jest.fn(),
    } as unknown as Response;

    controller.streamNotifications(request, response);

    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache, no-transform");
    expect(response.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
    expect(response.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");
    expect(response.flushHeaders).toHaveBeenCalled();
    expect(notificationRealtime.addConnection).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        close: expect.any(Function),
        sendEvent: expect.any(Function),
      }),
    );

    requestHandlers.get("close")?.();
    expect(cleanup).toHaveBeenCalled();
  });
});
