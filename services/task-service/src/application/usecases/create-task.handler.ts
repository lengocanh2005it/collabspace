// src/application/commands/create-task.handler.ts
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { Inject, BadRequestException } from "@nestjs/common";
import { CreateTaskCommand } from "../commands/create-task.command";
import { Task } from "../../domain/entities/Task";
import { TaskId } from "../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";
import {
  type IUserReplicaRepository,
  USER_REPLICA_REPOSITORY_TOKEN,
} from "../ports/IUserReplicaRepository";

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<
  CreateTaskCommand,
  string
> {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,

    // 👇 Inject thêm Replica Repo vào đây
    @Inject(USER_REPLICA_REPOSITORY_TOKEN)
    private readonly userReplicaRepo: IUserReplicaRepository,
  ) {}

  async execute(command: CreateTaskCommand): Promise<string> {
    const taskId = TaskId.create();

    // 1. Tự tra cứu người tạo từ danh bạ nội bộ
    const creatorRecord = await this.userReplicaRepo.findByIdAsync(
      command.creatorId,
    );
    if (!creatorRecord || !creatorRecord.isActive) {
      throw new BadRequestException(
        "Tài khoản người tạo Task không tồn tại hoặc đã bị khóa!",
      );
    }

    // 2. Tạo Snapshot chuẩn 5 tham số mới nhất
    const creator = UserSnapshot.create(
      creatorRecord.userId,
      creatorRecord.email,
      creatorRecord.fullName,
      creatorRecord.displayName,
      creatorRecord.avatarUrl,
    );

    // 3. Khởi tạo Entity
    const newTask = Task.create(
      taskId,
      command.title,
      command.description,
      command.workspaceId,
      creator,
      {
        projectId: command.projectId ?? null,
        priority: command.priority,
        dueDate: command.dueDate ?? null,
        labels: command.labels,
      },
    );

    await this.taskRepository.saveAsync(newTask);

    return taskId.getValue();
  }
}
