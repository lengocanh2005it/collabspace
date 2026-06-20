import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";
import type { TaskAssignedEventPayload } from "../../domain/events/task.events";
import type {
  CommentMentionedEventPayload,
  TaskCommentedEventPayload,
} from "../../domain/events/comment.events";
import {
  TASK_OUTBOX_AGGREGATE_TYPE,
  TASK_OUTBOX_EVENT_COMMENT_MENTIONED,
  TASK_OUTBOX_EVENT_TASK_ASSIGNED,
  TASK_OUTBOX_EVENT_TASK_COMMENTED,
  TaskOutboxEvent,
  type TaskOutboxEventDocument,
} from "./task-outbox.schema";

const MAX_ATTEMPTS = Number(process.env.TASK_OUTBOX_MAX_ATTEMPTS ?? 8);
const DEFAULT_BATCH_SIZE = Number(process.env.TASK_OUTBOX_BATCH_SIZE ?? 25);

type OutboxPayload =
  | TaskAssignedEventPayload
  | TaskCommentedEventPayload
  | CommentMentionedEventPayload;

@Injectable()
export class TaskOutboxService {
  constructor(
    @InjectModel(TaskOutboxEvent.name)
    private readonly outboxModel: Model<TaskOutboxEventDocument>,
  ) {}

  async enqueueTaskAssigned(
    payload: TaskAssignedEventPayload,
    session?: ClientSession,
  ): Promise<void> {
    await this.enqueueEvent(TASK_OUTBOX_EVENT_TASK_ASSIGNED, payload.taskId, payload, session);
  }

  async enqueueCommentMentioned(
    payload: CommentMentionedEventPayload,
    session?: ClientSession,
  ): Promise<void> {
    await this.enqueueCommentMentionedBatch([payload], session);
  }

  async enqueueCommentMentionedBatch(
    payloads: CommentMentionedEventPayload[],
    session?: ClientSession,
  ): Promise<void> {
    if (payloads.length === 0) {
      return;
    }

    if (session) {
      await this.outboxModel.insertMany(
        payloads.map((payload) =>
          this.buildOutboxDocument(TASK_OUTBOX_EVENT_COMMENT_MENTIONED, payload.taskId, payload),
        ),
        { session },
      );
      return;
    }

    await this.outboxModel.insertMany(
      payloads.map((payload) =>
        this.buildOutboxDocument(TASK_OUTBOX_EVENT_COMMENT_MENTIONED, payload.taskId, payload),
      ),
    );
  }

  async enqueueTaskCommented(
    payload: TaskCommentedEventPayload,
    session?: ClientSession,
  ): Promise<void> {
    await this.enqueueEvent(TASK_OUTBOX_EVENT_TASK_COMMENTED, payload.taskId, payload, session);
  }

  async claimPendingBatch(limit = DEFAULT_BATCH_SIZE): Promise<TaskOutboxEventDocument[]> {
    const batchSize = Math.max(1, Math.floor(limit));
    const now = new Date();
    const pendingFilter = {
      availableAt: { $lte: now },
      claimedAt: null,
      failedAt: null,
      processedAt: null,
    };

    const candidates = await this.outboxModel
      .find(pendingFilter)
      .sort({ availableAt: 1 })
      .limit(batchSize)
      .select({ _id: 1 })
      .lean()
      .exec();

    if (candidates.length === 0) {
      return [];
    }

    const candidateIds = candidates.map((candidate) => candidate._id);
    const claimTime = new Date();

    await this.outboxModel.bulkWrite(
      candidateIds.map((id) => ({
        updateOne: {
          filter: { _id: id, ...pendingFilter },
          update: {
            $set: { claimedAt: claimTime },
            $inc: { attemptCount: 1 },
          },
        },
      })),
      { ordered: false },
    );

    return this.outboxModel
      .find({
        _id: { $in: candidateIds },
        claimedAt: claimTime,
      })
      .sort({ availableAt: 1 })
      .exec();
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

  async markFailed(id: string, attemptCount: number, error: string): Promise<void> {
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

  private async enqueueEvent(
    eventType: string,
    aggregateId: string,
    payload: OutboxPayload,
    session?: ClientSession,
  ): Promise<void> {
    const document = this.buildOutboxDocument(eventType, aggregateId, payload);

    if (session) {
      await this.outboxModel.create([document], { session });
      return;
    }

    await this.outboxModel.create(document);
  }

  private buildOutboxDocument(
    eventType: string,
    aggregateId: string,
    payload: OutboxPayload,
  ): Record<string, unknown> {
    return {
      attemptCount: 0,
      availableAt: new Date(),
      claimedAt: null,
      aggregateType: TASK_OUTBOX_AGGREGATE_TYPE,
      aggregateId,
      eventType,
      failedAt: null,
      lastError: null,
      payload: payload,
      processedAt: null,
    };
  }

  private getRetryDelayMs(attemptCount: number): number {
    const baseDelayMs = 5_000;
    const cappedExponent = Math.min(Math.max(attemptCount - 1, 0), 6);
    return baseDelayMs * 2 ** cappedExponent;
  }
}
