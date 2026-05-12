// src/application/usecases/comments/create/create-comment.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, BadRequestException } from '@nestjs/common';
import { CreateCommentCommand } from './create-comment.command';
import { IUserReplicaRepository, USER_REPLICA_REPOSITORY_TOKEN } from 'src/application/ports/IUserReplicaRepository';
import { ICommentRepository, COMMENT_REPOSITORY_TOKEN } from '../../../../domain/repositories/comment.repository.interface';
import { ITaskRepository } from '../../../ports/ITaskRepository';
import { Comment } from '../../../../domain/entities/comment.entity';
import { TaskId } from '../../../../domain/value-objects/TaskId';
import { RabbitMqEventsService } from '../../../../infrastructure/messaging/rabbitmq/rabbitmq-events.service';
import { v4 as uuid } from 'uuid';

export interface CreateCommentResponse {
  commentId: string;
  message: string;
}

@CommandHandler(CreateCommentCommand)
export class CreateCommentHandler implements ICommandHandler<CreateCommentCommand, CreateCommentResponse> {
  constructor(
    @Inject(COMMENT_REPOSITORY_TOKEN)
    private readonly commentRepository: ICommentRepository,
    
    // 👇 Inject các vũ khí cần thiết
    @Inject(ITaskRepository)
    private readonly taskRepository: ITaskRepository,
    
    @Inject(USER_REPLICA_REPOSITORY_TOKEN)
    private readonly userReplicaRepo: IUserReplicaRepository,
    
    private readonly rabbitMqEvents: RabbitMqEventsService,
  ) {}

  async execute(command: CreateCommentCommand): Promise<CreateCommentResponse> {
    // 1. Kiểm tra Task và lấy Entity (dùng TaskId value object)
    const taskIdObj = new TaskId(command.taskId);
    const task = await this.taskRepository.findByIdAsync(taskIdObj);
    
    if (!task) {
      throw new BadRequestException(`Không tìm thấy Task với ID: ${command.taskId}`);
    }

    // 2. Tra cứu thông tin người comment từ Danh bạ nội bộ (Không tin Client)
    const authorRecord = await this.userReplicaRepo.findByIdAsync(command.authorId);
    
    if (!authorRecord || !authorRecord.isActive) {
      throw new BadRequestException('Tài khoản của bạn không tồn tại hoặc đã bị khóa!');
    }

    // 3. Khởi tạo Comment Entity với dữ liệu CHUẨN từ hệ thống Replica
    const commentId = uuid();
    const comment = Comment.create(
      commentId,
      command.taskId,
      command.authorId,
      authorRecord.fullName,  // ✅ Tên thật từ hệ thống
      authorRecord.avatarUrl || undefined, // ✅ Avatar thật từ hệ thống
      command.content,
      command.parentId || null,
    );

    // 4. Lưu Comment vào Database (TaskService DB)
    const savedCommentId = await this.commentRepository.createAsync(comment);

    // 5. Tính toán logic gửi Thông báo (Notification) qua RabbitMQ
    // Sử dụng Getter chuẩn từ Entity Task ông vừa cung cấp
    const assigneeId = task.getAssigneeId();

    // Luật: Chỉ báo Noti nếu Task CÓ người phụ trách, VÀ người phụ trách KHÁC với người vừa comment
    if (assigneeId && assigneeId !== command.authorId) {
      try {
        await this.rabbitMqEvents.publishTaskCommented({
          taskId: command.taskId,
          taskTitle: task.getTitle(), // ✅ Lấy tên task từ Entity
          recipientId: assigneeId,    // ✅ Gửi thẳng cho người phụ trách
          actorId: authorRecord.userId,
          actorName: authorRecord.fullName,
          actorAvatarUrl: authorRecord.avatarUrl || '',
          commentId: savedCommentId,
          // Cắt gọn nội dung comment nếu nó quá dài để làm preview
          commentPreview: command.content.length > 50 
            ? command.content.substring(0, 50) + '...' 
            : command.content,
          createdAt: new Date().toISOString(),
        });
        console.log(`📤 Bắn event task_commented thành công cho Task: ${command.taskId}`);
      } catch (error) {
        // Log lỗi nhưng không văng lỗi làm chết luồng chính 
        console.error('❌ RabbitMQ Publish task_commented Error:', error);
      }
    }

    // 6. Trả về kết quả cho Controller
    return {
      commentId: savedCommentId,
      message: 'Comment created successfully',
    };
  }
}