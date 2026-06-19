import { Injectable, Logger } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import type { CreateNotificationResponse } from "../usecases/create-notification/create-notification.handler";
import { InboundNotificationEventMapper } from "../mappers/inbound-notification-event.mapper";
import type { WorkspaceDeletedEventPayload } from "../../domain/events/workspace-events";
import {
  resolveCommandTimeoutMs,
  withCommandTimeout,
} from "../../presentation/helpers/notification-command.helper";
import type { NotificationTransport } from "./workspace-invite-notification.service";

export type WorkspaceDeleteProcessResult = "created" | "duplicate";

@Injectable()
export class WorkspaceDeletedNotificationService {
  private readonly logger = new Logger(WorkspaceDeletedNotificationService.name);

  constructor(private readonly commandBus: CommandBus) {}

  async processWorkspaceDeleted(
    data: WorkspaceDeletedEventPayload,
    transport: NotificationTransport,
  ): Promise<WorkspaceDeleteProcessResult> {
    const command = InboundNotificationEventMapper.toWorkspaceDeletedCommand(
      data,
      data.deletedById,
    );

    const result = await withCommandTimeout(
      this.commandBus.execute(command),
      resolveCommandTimeoutMs(),
    );

    if (this.isDuplicateResult(result)) {
      this.logger.log(
        `workspace_deleted duplicate via ${transport} eventId=${command.eventId ?? "unknown"}`,
      );
      return "duplicate";
    }

    this.logger.log(
      `workspace_deleted processed via ${transport} eventId=${command.eventId ?? "unknown"} notificationId=${result.notificationId}`,
    );
    return "created";
  }

  private isDuplicateResult(result: CreateNotificationResponse): boolean {
    return result.notificationId === "" && result.message.includes("already processed");
  }
}
