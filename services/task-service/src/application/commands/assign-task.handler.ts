// src/application/usecases/assign-task.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AssignTaskCommand } from '../commands/assign-task.command';
import { ITaskRepository } from '../ports/ITaskRepository';
import { IUserReplicaRepository } from '../ports/IUserReplicaRepository'; // Nhúng Repository mới
import { TaskId } from '../../domain/value-objects/TaskId';
import { UserSnapshot } from '../../domain/value-objects/UserSnapshot';
import { EntityNotFoundException } from '../../domain/exceptions/EntityNotFoundException';
import { BusinessRuleException } from '../../domain/exceptions/BusinessRuleException';
import { RabbitMqEventsService } from 'src/infrastructure/messaging/rabbitmq/rabbitmq-events.service';

@CommandHandler(AssignTaskCommand)
export class AssignTaskHandler implements ICommandHandler<AssignTaskCommand, void> {
  constructor(
    @Inject(ITaskRepository)
    private readonly taskRepository: ITaskRepository,
    
    // 👇 Tiêm UserReplicaRepository vào đây bằng trick Symbol
    @Inject(IUserReplicaRepository)
    private readonly userReplicaRepo: IUserReplicaRepository,
    
    private readonly rabbitMqEvents: RabbitMqEventsService,
  ) {}

  async execute(command: AssignTaskCommand): Promise<void> {
    const taskId = new TaskId(command.taskId);
    const task = await this.taskRepository.findByIdAsync(taskId);

    if (!task) {
      throw new EntityNotFoundException('Task', command.taskId);
    }

    // 1. Kiểm tra và lấy thông tin người đi giao (Assigner) từ DB nội bộ
    const assignerRecord = await this.userReplicaRepo.findByIdAsync(command.assignerId);
    if (!assignerRecord || !assignerRecord.isActive) {
      throw new BusinessRuleException('Tài khoản người giao task không hợp lệ hoặc đã bị khóa!');
    }

    const assignerSnapshot = UserSnapshot.create(
      assignerRecord.userId,
      assignerRecord.fullName,
      assignerRecord.avatarUrl
    );

    let shouldNotify = false;
    let assigneeSnapshot: UserSnapshot | null = null;

    // 2. Xử lý logic Assign/Unassign
    if (!command.assigneeId) {
      task.unassign();
    } else {
      // 3. Kiểm tra và lấy thông tin người nhận (Assignee) từ DB nội bộ
      const assigneeRecord = await this.userReplicaRepo.findByIdAsync(command.assigneeId);
      
      if (!assigneeRecord || !assigneeRecord.isActive) {
        throw new BusinessRuleException(`Người nhận task (ID: ${command.assigneeId}) không tồn tại hoặc đã bị khóa!`);
      }

      assigneeSnapshot = UserSnapshot.create(
        assigneeRecord.userId,
        assigneeRecord.fullName,
        assigneeRecord.avatarUrl
      );

      // Gán vào Domain Entity bằng Snapshot chuẩn xác từ hệ thống
      task.assignTo(command.assigneeId, assigneeSnapshot);
      shouldNotify = true;
    }

    // 4. Lưu Task vào Database
    await this.taskRepository.updateAsync(task);

    // 5. Bắn sự kiện sang RabbitMQ
    if (shouldNotify && assigneeSnapshot) {
      try {
        await this.rabbitMqEvents.publishTaskAssigned({
          taskId: command.taskId,
          taskTitle: task.getTitle(), 
          recipientId: assigneeSnapshot.getUserId(), 
          
          // Actor chính là người giao task
          actorId: assignerSnapshot.getUserId(),
          actorName: assignerSnapshot.getName(),
          actorAvatarUrl: assignerSnapshot.getAvatarUrl(),
          
          assignedAt: new Date().toISOString(),
          workspaceId: task.getWorkspaceId(), // Đảm bảo có workspaceId trong payload để Notification Service lọc đúng
        });
      } catch (error) {
        // Log lỗi nhưng không làm sập luồng chính (Outbox Pattern sau này có thể gắn vào đây)
        console.error('RabbitMQ Publish Error:', error);
      }
    }
  }
}