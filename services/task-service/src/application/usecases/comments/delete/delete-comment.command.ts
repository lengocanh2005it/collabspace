// src/application/usecases/comments/delete/delete-comment.command.ts

export class DeleteCommentCommand {
  constructor(
    public readonly commentId: string,
    public readonly taskId: string,
    public readonly authorId: string,
  ) {}
}
