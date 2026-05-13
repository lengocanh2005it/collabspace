// src/application/usecases/comments/create/create-comment.command.ts
export class CreateCommentCommand {
  constructor(
    public readonly taskId: string,
    public readonly authorId: string, // ID người đang đăng nhập
    public readonly content: string,
    public readonly parentId: string | null,
  ) {}
}
