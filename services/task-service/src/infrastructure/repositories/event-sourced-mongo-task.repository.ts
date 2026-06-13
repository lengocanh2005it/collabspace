// src/infrastructure/repositories/event-sourced-mongo-task.repository.ts
import { Injectable, Inject } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ITaskRepository } from "../../application/ports/ITaskRepository";
import type { TaskListFilter, TaskListOptions } from "../../application/ports/task-list-filter";
import { ITaskEventStore as ITaskEventStoreToken } from "../../application/ports/ITaskEventStore";
import type { ITaskEventStore } from "../../application/ports/ITaskEventStore";
import { ITaskActivityRepository as ITaskActivityRepositoryToken } from "../../application/ports/ITaskActivityRepository";
import type { ITaskActivityRepository } from "../../application/ports/ITaskActivityRepository";
import { Task as TaskDomain } from "../../domain/entities/Task";
import { TaskDomainEventType } from "../../domain/events/task-domain.events";
import { TaskId } from "../../domain/value-objects/TaskId";
import { EntityNotFoundException } from "../../domain/exceptions/EntityNotFoundException";
import { TaskPersistence } from "../persistence/task.schema";
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

  async saveAsync(domainTask: TaskDomain): Promise<void> {
    const uncommitted = [...domainTask.getUncommittedEvents()];
    if (uncommitted.length === 0) {
      return;
    }

    const streamId = domainTask.getId().getValue();
    const appended = await this.eventStore.append(
      streamId,
      domainTask.getVersion(),
      uncommitted,
    );
    domainTask.clearUncommittedEvents();
    domainTask.setVersion(appended[appended.length - 1].version);

    await this.taskActivityRepository.appendFromEventsAsync(streamId, appended);
    await this.syncProjectionFromAggregate(domainTask);
  }

  async findByIdAsync(id: TaskId): Promise<TaskDomain | null> {
    const rawDoc = await this.taskModel.findById(id.getValue()).exec();
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

    const rawDoc = await this.taskModel.findById(streamId).exec();
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

    const rawDocs = await query.exec();
    return rawDocs.map((doc) => TaskMapper.toDomain(doc));
  }

  async countByWorkspaceIdAsync(
    workspaceId: string,
    filter?: TaskListFilter,
  ): Promise<number> {
    const mongoFilter = this.buildWorkspaceFilter(workspaceId, filter);
    return this.taskModel.countDocuments(mongoFilter).exec();
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
  ): Promise<void> {
    const streamId = domainTask.getId().getValue();

    if (domainTask.isDeleted()) {
      await this.taskModel.deleteOne({ _id: streamId }).exec();
      return;
    }

    const persistenceData = TaskMapper.toPersistence(domainTask);
    await this.taskModel
      .findByIdAndUpdate(streamId, persistenceData, {
        upsert: true,
        new: true,
      })
      .exec();
  }
}
