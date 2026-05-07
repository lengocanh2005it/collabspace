// src/application/usecases/comments/create/create-comment.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateCommentCommand } from './create-comment.command';
import { ICommentRepository, COMMENT_REPOSITORY_TOKEN } from '../../../../domain/repositories/comment.repository.interface';
import { Comment } from '../../../../domain/entities/comment.entity';
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
  ) {}

  async execute(command: CreateCommentCommand): Promise<CreateCommentResponse> {
    // Step 1: Create comment entity with validation
    const commentId = uuid();
    const comment = Comment.create(
      commentId,
      command.taskId,
      command.authorId,
      command.authorName,
      command.authorAvatarUrl,
      command.content,
      command.parentId || null,
    );

    // Step 2: Persist comment to database
    const savedCommentId = await this.commentRepository.createAsync(comment);

    // Step 3: Return response
    return {
      commentId: savedCommentId,
      message: 'Comment created successfully',
    };
  }
}
