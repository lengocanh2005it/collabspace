// src/application/usecases/assign-task.handler.ts
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AssignTaskCommand } from "../commands/assign-task.command";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";
import {
  type IUserReplicaRepository,
  USER_REPLICA_REPOSITORY_TOKEN,
} from "../ports/IUserReplicaRepository";
import { TaskId } from "../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";
import { EntityNotFoundException } from "../../domain/exceptions/EntityNotFoundException";
import { BusinessRuleException } from "../../domain/exceptions/BusinessRuleException";
import { TaskOutboxService } from "../../infrastructure/outbox/task-outbox.service";

@CommandHandler(AssignTaskCommand)
export class AssignTaskHandler implements ICommandHandler<
  AssignTaskCommand,
  void
> {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
    @Inject(USER_REPLICA_REPOSITORY_TOKEN)
    private readonly userReplicaRepo: IUserReplicaRepository,
    private readonly taskOutboxService: TaskOutboxService,
  ) {}

  async execute(command: AssignTaskCommand): Promise<void> {
    const taskId = new TaskId(command.taskId);
    const task = await this.taskRepository.findByIdAsync(taskId);

    if (!task) {
      throw new EntityNotFoundException("Task", command.taskId);
    }

    // 1. Kiểm tra và lấy thông tin Assigner
    const assignerRecord = await this.userReplicaRepo.findByIdAsync(
      command.assignerId,
    );
    if (!assignerRecord || !assignerRecord.isActive) {
      throw new BusinessRuleException(
        "Tài khoản người giao task không hợp lệ hoặc đã bị khóa!",
      );
    }

    const assignerSnapshot = UserSnapshot.create(
      assignerRecord.userId,
      assignerRecord.email,
      assignerRecord.fullName,
      assignerRecord.displayName,
      assignerRecord.avatarUrl,
    );

    let shouldNotify = false;
    let assigneeSnapshot: UserSnapshot | null = null;

    // 2. Xử lý logic Assign/Unassign
    if (!command.assigneeId) {
      task.unassign();
    } else {
      // 3. Kiểm tra và lấy thông tin Assignee
      const assigneeRecord = await this.userReplicaRepo.findByIdAsync(
        command.assigneeId,
      );

      if (!assigneeRecord || !assigneeRecord.isActive) {
        throw new BusinessRuleException(
          `Người nhận task không tồn tại hoặc đã bị khóa!`,
        );
      }

      // 👇 Cập nhật chuẩn 5 tham số
      assigneeSnapshot = UserSnapshot.create(
        assigneeRecord.userId,
        assigneeRecord.email,
        assigneeRecord.fullName,
        assigneeRecord.displayName,
        assigneeRecord.avatarUrl,
      );

      task.assignTo(command.assigneeId, assigneeSnapshot);
      shouldNotify = true;
    }

    await this.taskRepository.updateAsync(task);

    // 5. Bắn sự kiện sang RabbitMQ
    if (shouldNotify && assigneeSnapshot) {
      await this.taskOutboxService.enqueueTaskAssigned({
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        taskId: command.taskId,
        taskTitle: task.getTitle(),
        recipientId: assigneeSnapshot.getUserId(),

        actorId: assignerSnapshot.getUserId(),
        actorName: assignerSnapshot.getDisplayName(),
        actorAvatarUrl: assignerSnapshot.getAvatarUrl() || undefined,

        assignedAt: new Date().toISOString(),
        workspaceId: task.getWorkspaceId(),
      });
    }
  }
}
