// src/application/usecases/comments/edit/edit-comment.handler.ts
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Inject, BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { EditCommentCommand } from "./edit-comment.command";
import {
  type ICommentRepository,
  COMMENT_REPOSITORY_TOKEN,
} from "../../../../domain/repositories/comment.repository.interface";
import { ITaskRepository as ITaskRepositoryToken } from "../../../../application/ports/ITaskRepository";
import type { ITaskRepository } from "../../../../application/ports/ITaskRepository";
import { TaskId } from "../../../../domain/value-objects/TaskId";

export interface EditCommentResponse {
  commentId: string;
  message: string;
  isEdited: boolean;
}

@CommandHandler(EditCommentCommand)
export class EditCommentHandler
  implements ICommandHandler<EditCommentCommand, EditCommentResponse>
{
  constructor(
    @Inject(COMMENT_REPOSITORY_TOKEN)
    private readonly commentRepository: ICommentRepository,
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(command: EditCommentCommand): Promise<EditCommentResponse> {
    // Step 1: Verify task exists
    const task = await this.taskRepository.findByIdAsync(new TaskId(command.taskId));
    if (!task) {
      throw new NotFoundException(`Task with ID ${command.taskId} not found`);
    }

    // Step 2: Fetch comment
    const comment = await this.commentRepository.findByIdAsync(command.commentId);
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${command.commentId} not found`);
    }

    // Step 3: Authorization check - only comment author can edit
    if (!comment.isOwnedBy(command.authorId)) {
      throw new ForbiddenException("You can only edit your own comments");
    }

    // Step 4: Update comment content
    comment.updateContent(command.newContent);

    // Step 5: Persist changes
    const updated = await this.commentRepository.updateAsync(comment);
    if (!updated) {
      throw new BadRequestException("Failed to update comment");
    }

    // Step 6: Return response with isEdited flag
    return {
      commentId: comment.getId(),
      message: "Comment edited successfully",
      isEdited: true,
    };
  }
}
