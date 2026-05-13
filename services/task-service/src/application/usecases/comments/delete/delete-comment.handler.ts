// src/application/usecases/comments/delete/delete-comment.handler.ts
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import {
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { DeleteCommentCommand } from "./delete-comment.command";
import {
  type ICommentRepository,
  COMMENT_REPOSITORY_TOKEN,
} from "../../../../domain/repositories/comment.repository.interface";
import { ITaskRepository as ITaskRepositoryToken } from "../../../../application/ports/ITaskRepository";
import type { ITaskRepository } from "../../../../application/ports/ITaskRepository";
import { TaskId } from "../../../../domain/value-objects/TaskId";

export interface DeleteCommentResponse {
  commentId: string;
  message: string;
  deletedAt: Date;
}

@CommandHandler(DeleteCommentCommand)
export class DeleteCommentHandler implements ICommandHandler<
  DeleteCommentCommand,
  DeleteCommentResponse
> {
  constructor(
    @Inject(COMMENT_REPOSITORY_TOKEN)
    private readonly commentRepository: ICommentRepository,
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(command: DeleteCommentCommand): Promise<DeleteCommentResponse> {
    // Step 1: Verify task exists
    const task = await this.taskRepository.findByIdAsync(
      new TaskId(command.taskId),
    );
    if (!task) {
      throw new NotFoundException(`Task with ID ${command.taskId} not found`);
    }

    // Step 2: Fetch comment
    const comment = await this.commentRepository.findByIdAsync(
      command.commentId,
    );
    if (!comment) {
      throw new NotFoundException(
        `Comment with ID ${command.commentId} not found`,
      );
    }

    // Step 3: Authorization check - only comment author can delete
    if (!comment.isOwnedBy(command.authorId)) {
      throw new ForbiddenException("You can only delete your own comments");
    }

    // Step 4: Mark comment as deleted (soft delete like Jira)
    comment.markAsDeleted();

    // Step 5: Persist changes
    const updated = await this.commentRepository.updateAsync(comment);
    if (!updated) {
      throw new BadRequestException("Failed to delete comment");
    }

    // Step 6: Return response
    return {
      commentId: comment.getId(),
      message: "Comment deleted successfully",
      deletedAt: comment.getDeletedAt()!,
    };
  }
}
