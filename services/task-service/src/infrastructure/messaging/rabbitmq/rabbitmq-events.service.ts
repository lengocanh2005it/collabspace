import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";
import {
  TASK_ASSIGNED_EVENT,
  TaskAssignedEventPayload,
} from "../../../domain/events/task.events";
import {
  COMMENT_MENTIONED_EVENT,
  CommentMentionedEventPayload,
  TASK_COMMENTED_EVENT,
  TaskCommentedEventPayload,
} from "../../../domain/events/comment.events";

@Injectable()
export class RabbitMqEventsService implements OnModuleDestroy {
  constructor(
    @Inject("NOTIFICATION_SERVICE")
    private readonly client: ClientProxy,
  ) {}

  async publishTaskAssigned(payload: TaskAssignedEventPayload): Promise<void> {
    await this.client.connect();
    await lastValueFrom(this.client.emit(TASK_ASSIGNED_EVENT, payload));
  }

  async publishTaskCommented(
    payload: TaskCommentedEventPayload,
  ): Promise<void> {
    await this.client.connect();

    console.log(`📤 [RABBITMQ] Đang bắn event: ${TASK_COMMENTED_EVENT}`);

    await lastValueFrom(this.client.emit(TASK_COMMENTED_EVENT, payload));
  }

  async publishCommentMentioned(
    payload: CommentMentionedEventPayload,
  ): Promise<void> {
    await this.client.connect();
    await lastValueFrom(this.client.emit(COMMENT_MENTIONED_EVENT, payload));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
