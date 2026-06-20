import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { runOutboxPollCycle } from "@collabspace/shared";
import type { TaskAssignedEventPayload } from "../../domain/events/task.events";
import type {
  CommentMentionedEventPayload,
  TaskCommentedEventPayload,
} from "../../domain/events/comment.events";
import { RabbitMqEventsService } from "../messaging/rabbitmq/rabbitmq-events.service";
import { TaskOutboxService } from "./task-outbox.service";
import { getTaskOutboxPublishMode } from "./task-outbox.config";
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

    if (getTaskOutboxPublishMode() === "debezium") {
      this.logger.log(
        "Task outbox RMQ processor disabled (TASK_OUTBOX_PUBLISH_MODE=debezium; CDC → Kafka).",
      );
      return;
    }

    const pollIntervalMs = Number(process.env.TASK_OUTBOX_POLL_INTERVAL_MS ?? 2000);

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
      await runOutboxPollCycle(
        {
          reclaimStaleClaims: () => this.taskOutboxService.reclaimStaleClaims(),
          claimPendingBatch: async () => {
            const batchSize = Number(process.env.TASK_OUTBOX_BATCH_SIZE ?? 25);
            const events = await this.taskOutboxService.claimPendingBatch(batchSize);
            return events.map((event) => ({
              id: String(event._id),
              eventType: event.eventType,
              payload: event.payload,
              attemptCount: event.attemptCount,
            }));
          },
          publish: (event) => this.publishEvent(event.eventType, event.payload),
          markProcessed: (id) => this.taskOutboxService.markProcessed(id),
          markFailed: (id, attemptCount, message) =>
            this.taskOutboxService.markFailed(id, attemptCount, message),
          logLabel: "task outbox",
          safeMarkFailed: true,
        },
        this.logger,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private async publishEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    if (eventType === TASK_OUTBOX_EVENT_TASK_ASSIGNED) {
      await this.rabbitMqEvents.publishTaskAssigned(payload as unknown as TaskAssignedEventPayload);
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
