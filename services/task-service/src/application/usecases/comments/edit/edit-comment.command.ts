// src/application/usecases/comments/edit/edit-comment.command.ts

export class EditCommentCommand {
  constructor(
    public readonly commentId: string,
    public readonly taskId: string,
    public readonly authorId: string,
    public readonly newContent: string,
  ) {}
}
