import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import type { ClientProxy } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";
import {
  TASK_ASSIGNED_EVENT,
  type TaskAssignedEventPayload,
} from "../../../domain/events/task.events";
import {
  COMMENT_MENTIONED_EVENT,
  type CommentMentionedEventPayload,
  TASK_COMMENTED_EVENT,
  type TaskCommentedEventPayload,
} from "../../../domain/events/comment.events";

@Injectable()
export class RabbitMqEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqEventsService.name);

  constructor(
    @Inject("NOTIFICATION_SERVICE")
    private readonly client: ClientProxy,
  ) {}

  async publishTaskAssigned(payload: TaskAssignedEventPayload): Promise<void> {
    await this.publish(TASK_ASSIGNED_EVENT, payload);
  }

  async publishTaskCommented(payload: TaskCommentedEventPayload): Promise<void> {
    await this.publish(TASK_COMMENTED_EVENT, payload);
  }

  async publishCommentMentioned(payload: CommentMentionedEventPayload): Promise<void> {
    await this.publish(COMMENT_MENTIONED_EVENT, payload);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  private async publish(event: string, payload: object): Promise<void> {
    await this.client.connect();
    this.logger.debug(`Publishing RabbitMQ event ${event}`);
    await lastValueFrom(this.client.emit(event, payload));
  }
}
