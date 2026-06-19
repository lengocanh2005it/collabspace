import { Injectable, Logger } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import type { CreateNotificationCommand } from "../usecases/create-notification/create-notification.command";
import type { CreateNotificationResponse } from "../usecases/create-notification/create-notification.handler";
import { InboundNotificationEventMapper } from "../mappers/inbound-notification-event.mapper";
import type { WorkspaceInvitedEventPayload } from "../../domain/events/workspace-events";
import { UserReplicaLookupService } from "./user-replica-lookup.service";
import {
  resolveCommandTimeoutMs,
  withCommandTimeout,
} from "../../presentation/helpers/notification-command.helper";

export type NotificationTransport = "kafka" | "rmq";

export type WorkspaceInviteProcessResult = "created" | "duplicate" | "skipped";

@Injectable()
export class WorkspaceInviteNotificationService {
  private readonly logger = new Logger(WorkspaceInviteNotificationService.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly userReplicaLookup: UserReplicaLookupService,
  ) {}

  async prepareWorkspaceInvitedCommand(
    data: WorkspaceInvitedEventPayload,
  ): Promise<CreateNotificationCommand | null> {
    const resolvedPayload = await this.resolveInviteRecipient(data);
    return InboundNotificationEventMapper.toWorkspaceInvitedCommand(resolvedPayload);
  }

  async processWorkspaceInvited(
    data: WorkspaceInvitedEventPayload,
    transport: NotificationTransport,
  ): Promise<WorkspaceInviteProcessResult> {
    const command = await this.prepareWorkspaceInvitedCommand(data);

    if (!command) {
      this.logger.warn(
        `Skipping workspace_invited via ${transport} without recipient user id for workspaceId=${data.workspaceId} inviteEmail=${data.inviteEmail ?? "unknown"}`,
      );
      return "skipped";
    }

    const result = await withCommandTimeout(
      this.commandBus.execute(command),
      resolveCommandTimeoutMs(),
    );

    if (this.isDuplicateResult(result)) {
      this.logger.log(
        `workspace_invited duplicate via ${transport} eventId=${command.eventId ?? "unknown"}`,
      );
      return "duplicate";
    }

    this.logger.log(
      `workspace_invited processed via ${transport} eventId=${command.eventId ?? "unknown"} notificationId=${result.notificationId}`,
    );
    return "created";
  }

  private async resolveInviteRecipient(
    data: WorkspaceInvitedEventPayload,
  ): Promise<WorkspaceInvitedEventPayload> {
    if (data.recipientId?.trim() || data.invitedUserId?.trim() || !data.inviteEmail?.trim()) {
      return data;
    }

    const recipientId = await this.userReplicaLookup.findActiveUserIdByEmailAsync(data.inviteEmail);
    if (!recipientId) {
      return data;
    }

    return { ...data, recipientId };
  }

  private isDuplicateResult(result: CreateNotificationResponse): boolean {
    return result.notificationId === "" && result.message.includes("already processed");
  }
}
