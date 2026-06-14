import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import {
  WORKSPACE_DELETED_EVENT,
  type WorkspaceDeletedEventPayload,
} from "@collabspace/shared";
import type { Channel, ConsumeMessage } from "amqplib";
import { WorkspaceDeletionService } from "../../../application/services/workspace-deletion.service";

@Controller()
export class WorkspaceEventController {
  private readonly logger = new Logger(WorkspaceEventController.name);

  constructor(private readonly deletionService: WorkspaceDeletionService) {}

  @EventPattern(WORKSPACE_DELETED_EVENT)
  async handleWorkspaceDeleted(
    @Payload() data: WorkspaceDeletedEventPayload,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;
    try {
      const deletedTasks = await this.deletionService.deleteWorkspaceData(
        data.workspaceId,
      );
      this.logger.warn(
        `workspace_deleted workspaceId=${data.workspaceId} deletedTasks=${deletedTasks}`,
      );
      channel.ack(message);
    } catch (error) {
      this.logger.error(
        `Failed to clean task data for workspaceId=${data.workspaceId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
