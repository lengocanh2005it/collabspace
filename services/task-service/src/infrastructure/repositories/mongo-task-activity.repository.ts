// src/infrastructure/repositories/mongo-task-activity.repository.ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { ITaskActivityRepository } from "../../application/ports/ITaskActivityRepository";
import { TaskActivityItemMapper } from "../../application/mappers/task-activity-item.mapper";
import type { Comment } from "../../domain/entities/comment.entity";
import type { StoredTaskDomainEvent } from "../../domain/events/task-domain.events";
import type { TaskActivityItemData } from "../../presentation/dtos/task-activity.response";
import type { MongoSessionOptions } from "../../application/ports/mongo-session-options";
import {
  TaskActivityPersistence,
  type TaskActivityDocument,
} from "../persistence/task-activity.schema";

@Injectable()
export class MongoTaskActivityRepository implements ITaskActivityRepository {
  constructor(
    @InjectModel(TaskActivityPersistence.name)
    private readonly activityModel: Model<TaskActivityDocument>,
  ) {}

  async appendFromEventsAsync(
    taskId: string,
    events: StoredTaskDomainEvent[],
    options?: MongoSessionOptions,
  ): Promise<void> {
    const items = TaskActivityItemMapper.fromStoredEvents(events);
    await this.appendItems(taskId, items, options);
  }

  async appendFromCommentAsync(comment: Comment, options?: MongoSessionOptions): Promise<void> {
    await this.appendItems(
      comment.getTaskId(),
      [TaskActivityItemMapper.fromComment(comment)],
      options,
    );
  }

  async findByTaskIdAsync(
    taskId: string,
    options: { offset: number; limit: number },
  ): Promise<TaskActivityItemData[]> {
    const documents = await this.activityModel
      .find({ taskId })
      .sort({ occurredAt: 1 })
      .skip(options.offset)
      .limit(options.limit)
      .lean()
      .exec();

    return documents.map((document) => this.toItemData(document));
  }

  async countByTaskIdAsync(taskId: string): Promise<number> {
    return this.activityModel.countDocuments({ taskId }).exec();
  }

  private async appendItems(
    taskId: string,
    items: TaskActivityItemData[],
    options?: MongoSessionOptions,
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    await this.activityModel.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { _id: item.id },
          update: {
            $set: {
              taskId,
              type: item.type,
              actorId: item.actorId,
              actorName: item.actorName,
              actorAvatarUrl: item.actorAvatarUrl,
              summary: item.summary,
              meta: item.meta,
              occurredAt: new Date(item.occurredAt),
            },
          },
          upsert: true,
        },
      })),
      {
        ordered: false,
        ...(options?.session ? { session: options.session } : {}),
      },
    );
  }

  private toItemData(document: TaskActivityPersistence): TaskActivityItemData {
    return {
      id: document._id,
      type: document.type as TaskActivityItemData["type"],
      actorId: document.actorId,
      actorName: document.actorName,
      actorAvatarUrl: document.actorAvatarUrl,
      summary: document.summary,
      meta: document.meta,
      occurredAt: document.occurredAt.toISOString(),
    };
  }
}
