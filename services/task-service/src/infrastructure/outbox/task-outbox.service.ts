import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { TaskAssignedEventPayload } from "../../domain/events/task.events";
import {
  CommentMentionedEventPayload,
  TaskCommentedEventPayload,
} from "../../domain/events/comment.events";
import {
  TASK_OUTBOX_EVENT_COMMENT_MENTIONED,
  TASK_OUTBOX_EVENT_TASK_ASSIGNED,
  TASK_OUTBOX_EVENT_TASK_COMMENTED,
  TaskOutboxEvent,
  TaskOutboxEventDocument,
} from "./task-outbox.schema";

const MAX_ATTEMPTS = Number(process.env.TASK_OUTBOX_MAX_ATTEMPTS ?? 8);

@Injectable()
export class TaskOutboxService {
  constructor(
    @InjectModel(TaskOutboxEvent.name)
    private readonly outboxModel: Model<TaskOutboxEventDocument>,
  ) {}

  async enqueueTaskAssigned(payload: TaskAssignedEventPayload): Promise<void> {
    await this.outboxModel.create({
      attemptCount: 0,
      availableAt: new Date(),
      claimedAt: null,
      eventType: TASK_OUTBOX_EVENT_TASK_ASSIGNED,
      failedAt: null,
      lastError: null,
      payload: payload,
      processedAt: null,
    });
  }

  async enqueueCommentMentioned(
    payload: CommentMentionedEventPayload,
  ): Promise<void> {
    await this.enqueueCommentMentionedBatch([payload]);
  }

  async enqueueCommentMentionedBatch(
    payloads: CommentMentionedEventPayload[],
  ): Promise<void> {
    if (payloads.length === 0) {
      return;
    }

    await this.outboxModel.insertMany(
      payloads.map((payload) => ({
        attemptCount: 0,
        availableAt: new Date(),
        claimedAt: null,
        eventType: TASK_OUTBOX_EVENT_COMMENT_MENTIONED,
        failedAt: null,
        lastError: null,
        payload: payload as unknown as Record<string, unknown>,
        processedAt: null,
      })),
    );
  }

  async enqueueTaskCommented(
    payload: TaskCommentedEventPayload,
  ): Promise<void> {
    await this.outboxModel.create({
      attemptCount: 0,
      availableAt: new Date(),
      claimedAt: null,
      eventType: TASK_OUTBOX_EVENT_TASK_COMMENTED,
      failedAt: null,
      lastError: null,
      payload: payload as unknown as Record<string, unknown>,
      processedAt: null,
    });
  }

  async claimPendingBatch(limit = 25): Promise<TaskOutboxEventDocument[]> {
    const claimed: TaskOutboxEventDocument[] = [];

    for (let index = 0; index < limit; index += 1) {
      const event = await this.outboxModel.findOneAndUpdate(
        {
          availableAt: { $lte: new Date() },
          claimedAt: null,
          failedAt: null,
          processedAt: null,
        },
        {
          $set: { claimedAt: new Date() },
          $inc: { attemptCount: 1 },
        },
        { new: true, sort: { availableAt: 1 } },
      );

      if (!event) {
        break;
      }

      claimed.push(event);
    }

    return claimed;
  }

  async markProcessed(id: string): Promise<void> {
    await this.outboxModel.updateOne(
      { _id: id },
      {
        $set: {
          claimedAt: null,
          failedAt: null,
          lastError: null,
          processedAt: new Date(),
        },
      },
    );
  }

  async markFailed(
    id: string,
    attemptCount: number,
    error: string,
  ): Promise<void> {
    const isPermanentFailure = attemptCount >= MAX_ATTEMPTS;

    await this.outboxModel.updateOne(
      { _id: id },
      {
        $set: {
          availableAt: isPermanentFailure
            ? undefined
            : new Date(Date.now() + this.getRetryDelayMs(attemptCount)),
          claimedAt: null,
          failedAt: isPermanentFailure ? new Date() : null,
          lastError: error,
        },
      },
    );
  }

  async reclaimStaleClaims(staleThresholdMs = 60_000): Promise<number> {
    const staleBefore = new Date(Date.now() - staleThresholdMs);
    const result = await this.outboxModel.updateMany(
      {
        claimedAt: { $lte: staleBefore },
        failedAt: null,
        processedAt: null,
      },
      {
        $set: {
          availableAt: new Date(),
          claimedAt: null,
          lastError: "stale claim recovered for retry",
        },
      },
    );

    return result.modifiedCount;
  }

  private getRetryDelayMs(attemptCount: number): number {
    const baseDelayMs = 5_000;
    const cappedExponent = Math.min(Math.max(attemptCount - 1, 0), 6);
    return baseDelayMs * 2 ** cappedExponent;
  }
}
