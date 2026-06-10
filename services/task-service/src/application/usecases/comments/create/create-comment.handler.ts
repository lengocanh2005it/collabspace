// src/application/usecases/comments/create/create-comment.handler.ts
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { Inject, BadRequestException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { CreateCommentCommand } from "./create-comment.command";
import {
  type IUserReplicaRepository,
  USER_REPLICA_REPOSITORY_TOKEN,
} from "../../../ports/IUserReplicaRepository";
import {
  type ICommentRepository,
  COMMENT_REPOSITORY_TOKEN,
} from "../../../../domain/repositories/comment.repository.interface";
import { ITaskRepository as ITaskRepositoryToken } from "../../../ports/ITaskRepository";
import type { ITaskRepository } from "../../../ports/ITaskRepository";
import { Comment } from "../../../../domain/entities/comment.entity";
import { TaskId } from "../../../../domain/value-objects/TaskId";
import { TaskOutboxService } from "../../../../infrastructure/outbox/task-outbox.service";
import { parseMentionUsernames } from "../../../../domain/utils/mention-parser";
import { v4 as uuid } from "uuid";

export interface CreateCommentResponse {
  commentId: string;
  message: string;
}

@CommandHandler(CreateCommentCommand)
export class CreateCommentHandler implements ICommandHandler<
  CreateCommentCommand,
  CreateCommentResponse
> {
  constructor(
    @Inject(COMMENT_REPOSITORY_TOKEN)
    private readonly commentRepository: ICommentRepository,

    // 👇 Inject các vũ khí cần thiết
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,

    @Inject(USER_REPLICA_REPOSITORY_TOKEN)
    private readonly userReplicaRepo: IUserReplicaRepository,

    private readonly taskOutboxService: TaskOutboxService,
  ) {}

  async execute(command: CreateCommentCommand): Promise<CreateCommentResponse> {
    // 1. Kiểm tra Task và lấy Entity (dùng TaskId value object)
    const taskIdObj = new TaskId(command.taskId);
    const task = await this.taskRepository.findByIdAsync(taskIdObj);

    if (!task) {
      throw new BadRequestException(
        `Không tìm thấy Task với ID: ${command.taskId}`,
      );
    }

    // 2. Tra cứu thông tin người comment từ Danh bạ nội bộ (Không tin Client)
    const authorRecord = await this.userReplicaRepo.findByIdAsync(
      command.authorId,
    );

    if (!authorRecord || !authorRecord.isActive) {
      throw new BadRequestException(
        "Tài khoản của bạn không tồn tại hoặc đã bị khóa!",
      );
    }

    // 3. Khởi tạo Comment Entity với dữ liệu CHUẨN từ hệ thống Replica
    const commentId = uuid();
    const comment = Comment.create(
      commentId,
      command.taskId,
      command.authorId,
      authorRecord.fullName,
      authorRecord.avatarUrl || undefined,
      command.content,
      command.parentId || null,
    );

    const mentionedUserIds: string[] = [];
    for (const username of parseMentionUsernames(command.content)) {
      const mentionedUser = await this.userReplicaRepo.findByUsernameAsync(
        username,
      );
      if (
        mentionedUser &&
        mentionedUser.isActive &&
        mentionedUser.userId !== command.authorId
      ) {
        try {
          comment.addMention(mentionedUser.userId);
          mentionedUserIds.push(mentionedUser.userId);
        } catch {
          // Ignore duplicate mentions in the same comment.
        }
      }
    }

    // 4. Lưu Comment vào Database (TaskService DB)
    const savedCommentId = await this.commentRepository.createAsync(comment);

    // 5. Tính toán logic gửi Thông báo (Notification) qua RabbitMQ
    // Sử dụng Getter chuẩn từ Entity Task ông vừa cung cấp
    const assigneeId = task.getAssigneeId();

    // Luật: Chỉ báo Noti nếu Task CÓ người phụ trách, VÀ người phụ trách KHÁC với người vừa comment
    const commentPreview =
      command.content.length > 50
        ? command.content.substring(0, 50) + "..."
        : command.content;

    if (assigneeId && assigneeId !== command.authorId) {
      await this.taskOutboxService.enqueueTaskCommented({
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        taskId: command.taskId,
        taskTitle: task.getTitle(),
        recipientId: assigneeId,
        actorId: authorRecord.userId,
        actorName: authorRecord.fullName,
        actorAvatarUrl: authorRecord.avatarUrl || "",
        commentId: savedCommentId,
        commentPreview,
        createdAt: new Date().toISOString(),
      });
    }

    for (const recipientId of mentionedUserIds) {
      if (recipientId === assigneeId) {
        continue;
      }

      await this.taskOutboxService.enqueueCommentMentioned({
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        taskId: command.taskId,
        taskTitle: task.getTitle(),
        recipientId,
        actorId: authorRecord.userId,
        actorName: authorRecord.fullName,
        actorAvatarUrl: authorRecord.avatarUrl || "",
        commentId: savedCommentId,
        commentPreview,
        createdAt: new Date().toISOString(),
      });
    }

    // 6. Trả về kết quả cho Controller
    return {
      commentId: savedCommentId,
      message: "Comment created successfully",
    };
  }
}
