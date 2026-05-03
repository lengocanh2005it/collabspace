// src/infrastructure/repositories/mongo-task.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITaskRepository } from '../../application/ports/ITaskRepository';
import { TaskPersistence } from '../persistence/task.schema';
import { TaskMapper } from '../mappers/task.mapper';
import { Task as TaskDomain } from '../../domain/entities/Task';
import { TaskId } from '../../domain/value-objects/TaskId';
import { EntityNotFoundException } from '../../domain/exceptions/EntityNotFoundException';

@Injectable()
export class MongoTaskRepository implements ITaskRepository {
  constructor(
    @InjectModel('TaskPersistence') private readonly taskModel: Model<TaskPersistence>
  ) {}

  async addAsync(domainTask: TaskDomain): Promise<void> {
    const persistenceData = TaskMapper.toPersistence(domainTask);
    const createdTask = new this.taskModel(persistenceData);
    await createdTask.save();
  }

  async findByIdAsync(id: TaskId): Promise<TaskDomain | null> {
    const rawDoc = await this.taskModel.findById(id.getValue()).exec();
    if (!rawDoc) return null;
    return TaskMapper.toDomain(rawDoc);
  }

  async findByWorkspaceIdAsync(workspaceId: string): Promise<TaskDomain[]> {
    const rawDocs = await this.taskModel.find({ workspaceId }).exec();
    return rawDocs.map(doc => TaskMapper.toDomain(doc));
  }

  async updateAsync(domainTask: TaskDomain): Promise<void> {
    const persistenceData = TaskMapper.toPersistence(domainTask);
    const taskIdString = domainTask.getId().getValue();

    const result = await this.taskModel.updateOne(
      { _id: taskIdString },
      { $set: persistenceData }
    ).exec();

    if (result.matchedCount === 0) {
      throw new EntityNotFoundException('Task', taskIdString);
    }
  }

  async deleteAsync(id: TaskId): Promise<void> {
    const result = await this.taskModel.deleteOne({ _id: id.getValue() }).exec();
    if (result.deletedCount === 0) {
      throw new EntityNotFoundException('Task', id.getValue());
    }
  }
}