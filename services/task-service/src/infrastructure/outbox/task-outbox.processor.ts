import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { TaskAssignedEventPayload } from "../../domain/events/task.events";
import {
  CommentMentionedEventPayload,
  TaskCommentedEventPayload,
} from "../../domain/events/comment.events";
import { RabbitMqEventsService } from "../messaging/rabbitmq/rabbitmq-events.service";
import { TaskOutboxService } from "./task-outbox.service";
import {
  TASK_OUTBOX_EVENT_COMMENT_MENTIONED,
  TASK_OUTBOX_EVENT_TASK_ASSIGNED,
  TASK_OUTBOX_EVENT_TASK_COMMENTED,
} from "./task-outbox.schema";

@Injectable()
export class TaskOutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskOutboxProcessor.name);
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly taskOutboxService: TaskOutboxService,
    private readonly rabbitMqEvents: RabbitMqEventsService,
  ) {}

  onModuleInit(): void {
    const enabled = process.env.TASK_OUTBOX_ENABLED !== "false";

    if (!enabled) {
      this.logger.log("Task outbox processor is disabled.");
      return;
    }

    const pollIntervalMs = Number(
      process.env.TASK_OUTBOX_POLL_INTERVAL_MS ?? 2000,
    );

    this.timer = setInterval(() => {
      void this.processPendingEvents();
    }, pollIntervalMs);
    this.timer.unref();
    void this.processPendingEvents();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processPendingEvents(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const reclaimed = await this.taskOutboxService.reclaimStaleClaims();

      if (reclaimed > 0) {
        this.logger.warn(`Reclaimed ${reclaimed} stale task outbox event(s)`);
      }

      const events = await this.taskOutboxService.claimPendingBatch();

      for (const event of events) {
        try {
          await this.publishEvent(event.eventType, event.payload);
          await this.taskOutboxService.markProcessed(String(event._id));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown task outbox error";
          this.logger.warn(
            `Task outbox publish failed for ${String(event._id)}: ${message}`,
          );
          await this.taskOutboxService.markFailed(
            String(event._id),
            event.attemptCount,
            message,
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async publishEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (eventType === TASK_OUTBOX_EVENT_TASK_ASSIGNED) {
      await this.rabbitMqEvents.publishTaskAssigned(
        payload as unknown as TaskAssignedEventPayload,
      );
      return;
    }

    if (eventType === TASK_OUTBOX_EVENT_TASK_COMMENTED) {
      await this.rabbitMqEvents.publishTaskCommented(
        payload as unknown as TaskCommentedEventPayload,
      );
      return;
    }

    if (eventType === TASK_OUTBOX_EVENT_COMMENT_MENTIONED) {
      await this.rabbitMqEvents.publishCommentMentioned(
        payload as unknown as CommentMentionedEventPayload,
      );
      return;
    }

    throw new Error(`Unsupported task outbox event type: ${eventType}`);
  }
}
