// src/application/usecases/comments/create/create-comment.handler.ts
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Inject, BadRequestException } from "@nestjs/common";
import { CreateCommentCommand } from "./create-comment.command";
import {
  USER_REPLICA_LOOKUP_TOKEN,
  type UserReplicaLookupService,
} from "../../../services/user-replica-lookup.service";
import {
  type ICommentRepository,
  COMMENT_REPOSITORY_TOKEN,
} from "../../../../domain/repositories/comment.repository.interface";
import { ITaskRepository as ITaskRepositoryToken } from "../../../ports/ITaskRepository";
import type { ITaskRepository } from "../../../ports/ITaskRepository";
import { Comment } from "../../../../domain/entities/comment.entity";
import { TaskId } from "../../../../domain/value-objects/TaskId";
import { TaskCommentNotificationPublisher } from "../../../services/task-comment-notification.publisher";
import { ITaskActivityRepository as ITaskActivityRepositoryToken } from "../../../ports/ITaskActivityRepository";
import type { ITaskActivityRepository } from "../../../ports/ITaskActivityRepository";
import { parseMentionUsernames } from "../../../../domain/utils/mention-parser";
import { v4 as uuid } from "uuid";
import {
  MONGO_UNIT_OF_WORK,
  type IMongoUnitOfWork,
} from "../../../../domain/ports/mongo-unit-of-work.port";

export interface CreateCommentResponse {
  commentId: string;
  message: string;
}

@CommandHandler(CreateCommentCommand)
export class CreateCommentHandler
  implements ICommandHandler<CreateCommentCommand, CreateCommentResponse>
{
  constructor(
    @Inject(COMMENT_REPOSITORY_TOKEN)
    private readonly commentRepository: ICommentRepository,

    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,

    @Inject(USER_REPLICA_LOOKUP_TOKEN)
    private readonly userReplicaLookup: UserReplicaLookupService,

    private readonly commentNotificationPublisher: TaskCommentNotificationPublisher,

    @Inject(ITaskActivityRepositoryToken)
    private readonly taskActivityRepository: ITaskActivityRepository,

    @Inject(MONGO_UNIT_OF_WORK)
    private readonly unitOfWork: IMongoUnitOfWork,
  ) {}

  async execute(command: CreateCommentCommand): Promise<CreateCommentResponse> {
    const taskIdObj = new TaskId(command.taskId);
    const task = await this.taskRepository.findByIdAsync(taskIdObj);

    if (!task) {
      throw new BadRequestException(`Không tìm thấy Task với ID: ${command.taskId}`);
    }

    const authorRecord = await this.userReplicaLookup.findActiveByIdAsync(command.authorId);

    if (!authorRecord?.isActive) {
      throw new BadRequestException("Tài khoản của bạn không tồn tại hoặc đã bị khóa!");
    }

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
    const mentionUsernames = parseMentionUsernames(command.content);
    if (mentionUsernames.length > 0) {
      const mentionMap =
        await this.userReplicaLookup.findActiveMapByUsernamesAsync(mentionUsernames);
      for (const username of mentionUsernames) {
        const mentionedUser = mentionMap.get(username.toLowerCase());
        if (mentionedUser && mentionedUser.userId !== command.authorId) {
          try {
            comment.addMention(mentionedUser.userId);
            mentionedUserIds.push(mentionedUser.userId);
          } catch {
            // Ignore duplicate mentions in the same comment.
          }
        }
      }
    }

    const savedCommentId = await this.unitOfWork.run(async (session) => {
      const commentId = await this.commentRepository.createAsync(comment, { session });

      await this.taskActivityRepository.appendFromCommentAsync(
        Comment.restore(
          commentId,
          comment.getTaskId(),
          comment.getAuthorId(),
          comment.getAuthorName(),
          comment.getAuthorAvatarUrl(),
          comment.getContent(),
          comment.getParentId(),
          comment.getMentions(),
          comment.getIsEdited(),
          comment.getDeletedAt(),
          comment.getReactionCount(),
          comment.getCreatedAt(),
          comment.getUpdatedAt(),
        ),
        { session },
      );

      await this.commentNotificationPublisher.publishForNewComment(
        {
          taskId: command.taskId,
          taskTitle: task.getTitle(),
          assigneeId: task.getAssigneeId(),
          authorId: authorRecord.userId,
          authorName: authorRecord.fullName,
          authorAvatarUrl: authorRecord.avatarUrl || "",
          commentId,
          content: command.content,
          mentionedUserIds,
        },
        session,
      );

      return commentId;
    });

    return {
      commentId: savedCommentId,
      message: "Comment created successfully",
    };
  }
}
