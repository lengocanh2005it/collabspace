// src/infrastructure/repositories/event-sourced-mongo-task.repository.ts
import { Injectable, Inject } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { ITaskRepository } from "../../application/ports/ITaskRepository";
import type { TaskListFilter, TaskListOptions } from "../../application/ports/task-list-filter";
import type { MongoSessionOptions } from "../../application/ports/mongo-session-options";
import { ITaskEventStore as ITaskEventStoreToken } from "../../application/ports/ITaskEventStore";
import type { ITaskEventStore } from "../../application/ports/ITaskEventStore";
import { ITaskActivityRepository as ITaskActivityRepositoryToken } from "../../application/ports/ITaskActivityRepository";
import type { ITaskActivityRepository } from "../../application/ports/ITaskActivityRepository";
import { Task as TaskDomain } from "../../domain/entities/Task";
import { TaskDomainEventType } from "../../domain/events/task-domain.events";
import type { TaskId } from "../../domain/value-objects/TaskId";
import { EntityNotFoundException } from "../../domain/exceptions/EntityNotFoundException";
import type { TaskPersistence } from "../persistence/task.schema";
import { TaskMapper } from "../mappers/task.mapper";

@Injectable()
export class EventSourcedMongoTaskRepository implements ITaskRepository {
  constructor(
    @InjectModel("TaskPersistence")
    private readonly taskModel: Model<TaskPersistence>,
    @Inject(ITaskEventStoreToken)
    private readonly eventStore: ITaskEventStore,
    @Inject(ITaskActivityRepositoryToken)
    private readonly taskActivityRepository: ITaskActivityRepository,
  ) {}

  async saveAsync(domainTask: TaskDomain, options?: MongoSessionOptions): Promise<void> {
    const uncommitted = [...domainTask.getUncommittedEvents()];
    if (uncommitted.length === 0) {
      return;
    }

    const streamId = domainTask.getId().getValue();
    const appended = await this.eventStore.append(
      streamId,
      domainTask.getVersion(),
      uncommitted,
      options,
    );
    domainTask.clearUncommittedEvents();
    domainTask.setVersion(appended[appended.length - 1].version);

    await this.taskActivityRepository.appendFromEventsAsync(streamId, appended, options);
    await this.syncProjectionFromAggregate(domainTask, options);
  }

  async findByIdAsync(id: TaskId): Promise<TaskDomain | null> {
    const rawDoc = await this.taskModel.findById(id.getValue()).lean().exec();
    if (!rawDoc) return null;
    return TaskMapper.toDomain(rawDoc);
  }

  async loadAggregateByIdAsync(id: TaskId): Promise<TaskDomain | null> {
    const streamId = id.getValue();
    const events = await this.eventStore.loadStream(streamId);

    if (events.length > 0) {
      const lastEvent = events[events.length - 1];
      if (lastEvent.eventType === TaskDomainEventType.TaskDeleted) {
        return null;
      }

      return TaskDomain.fromHistory(events);
    }

    const rawDoc = await this.taskModel.findById(streamId).lean().exec();
    if (!rawDoc) return null;

    return TaskMapper.toDomain(rawDoc, 0);
  }

  async findByWorkspaceIdAsync(
    workspaceId: string,
    filter?: TaskListFilter,
    options?: TaskListOptions,
  ): Promise<TaskDomain[]> {
    const mongoFilter = this.buildWorkspaceFilter(workspaceId, filter);
    let query = this.taskModel.find(mongoFilter).sort({ updatedAt: -1 });

    if (options?.skip != null && options.skip > 0) {
      query = query.skip(options.skip);
    }
    if (options?.limit != null && options.limit > 0) {
      query = query.limit(options.limit);
    }

    const rawDocs = await query.lean().exec();
    return rawDocs.map((doc) => TaskMapper.toDomain(doc));
  }

  async countByWorkspaceIdAsync(workspaceId: string, filter?: TaskListFilter): Promise<number> {
    const mongoFilter = this.buildWorkspaceFilter(workspaceId, filter);
    return this.taskModel.countDocuments(mongoFilter).exec();
  }

  async countByWorkspaceGrouped(): Promise<Record<string, number>> {
    const rows = await this.taskModel
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$workspaceId", count: { $sum: 1 } } },
      ])
      .exec();
    return Object.fromEntries(
      rows
        .filter((row) => typeof row._id === "string" && row._id.length > 0)
        .map((row) => [row._id, row.count]),
    );
  }

  async countByStatusGrouped(): Promise<Record<string, number>> {
    const rows = await this.taskModel
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .exec();
    return Object.fromEntries(
      rows
        .filter((row) => typeof row._id === "string" && row._id.length > 0)
        .map((row) => [row._id, row.count]),
    );
  }

  private buildWorkspaceFilter(
    workspaceId: string,
    filter?: TaskListFilter,
  ): Record<string, unknown> {
    const mongoFilter: Record<string, unknown> = { workspaceId };

    if (filter?.status) {
      mongoFilter.status = filter.status;
    }
    if (filter?.assigneeId) {
      mongoFilter.assigneeId = filter.assigneeId;
    }
    if (filter?.priority) {
      mongoFilter.priority = filter.priority;
    }
    if (filter?.projectId) {
      mongoFilter.projectId = filter.projectId;
    }
    if (filter?.search) {
      const escaped = filter.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(escaped, "i");
      mongoFilter.$or = [{ title: pattern }, { description: pattern }];
    }

    return mongoFilter;
  }

  async deleteAsync(id: TaskId): Promise<void> {
    const task = await this.loadAggregateByIdAsync(id);
    if (!task) {
      throw new EntityNotFoundException("Task", id.getValue());
    }

    task.delete();
    await this.saveAsync(task);
  }

  async addAttachmentAsync(taskId: TaskId, fileUrl: string): Promise<void> {
    const result = await this.taskModel
      .updateOne(
        { _id: taskId.getValue() },
        {
          $addToSet: { attachments: fileUrl },
          $set: { updatedAt: new Date() },
        },
      )
      .exec();

    if (result.matchedCount === 0) {
      throw new EntityNotFoundException("Task", taskId.getValue());
    }
  }

  async removeAttachmentAsync(taskId: TaskId, fileUrl: string): Promise<void> {
    const result = await this.taskModel
      .updateOne(
        { _id: taskId.getValue() },
        {
          $pull: { attachments: fileUrl },
          $set: { updatedAt: new Date() },
        },
      )
      .exec();

    if (result.matchedCount === 0) {
      throw new EntityNotFoundException("Task", taskId.getValue());
    }
  }

  private async syncProjectionFromAggregate(
    domainTask: TaskDomain,
    options?: MongoSessionOptions,
  ): Promise<void> {
    const streamId = domainTask.getId().getValue();

    if (domainTask.isDeleted()) {
      await this.taskModel
        .deleteOne({ _id: streamId }, options?.session ? { session: options.session } : undefined)
        .exec();
      return;
    }

    const persistenceData = TaskMapper.toPersistence(domainTask);
    await this.taskModel
      .findByIdAndUpdate(streamId, persistenceData, {
        upsert: true,
        new: true,
        session: options?.session,
      })
      .exec();
  }
}
