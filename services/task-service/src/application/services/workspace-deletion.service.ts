import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  TaskActivityPersistence,
  type TaskActivityDocument,
} from "../../infrastructure/persistence/task-activity.schema";
import {
  TaskComment,
  type TaskCommentDocument,
} from "../../infrastructure/persistence/task-comment.schema";
import {
  TaskEventPersistence,
  type TaskEventDocument,
} from "../../infrastructure/persistence/task-event.schema";
import { TaskPersistence, type TaskDocument } from "../../infrastructure/persistence/task.schema";

@Injectable()
export class WorkspaceDeletionService {
  constructor(
    @InjectModel(TaskPersistence.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskComment.name)
    private readonly commentModel: Model<TaskCommentDocument>,
    @InjectModel(TaskActivityPersistence.name)
    private readonly activityModel: Model<TaskActivityDocument>,
    @InjectModel(TaskEventPersistence.name)
    private readonly eventModel: Model<TaskEventDocument>,
  ) {}

  async deleteWorkspaceData(workspaceId: string): Promise<number> {
    const taskIds = await this.taskModel.distinct("_id", { workspaceId }).exec();
    if (taskIds.length === 0) return 0;

    await Promise.all([
      this.commentModel.deleteMany({ taskId: { $in: taskIds } }).exec(),
      this.activityModel.deleteMany({ taskId: { $in: taskIds } }).exec(),
      this.eventModel.deleteMany({ streamId: { $in: taskIds } }).exec(),
      this.taskModel.deleteMany({ _id: { $in: taskIds } }).exec(),
    ]);
    return taskIds.length;
  }
}
