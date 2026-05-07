// src/application/usecases/comments/create/create-comment.command.ts

export class CreateCommentCommand {
  constructor(
    public readonly taskId: string,
    public readonly authorId: string,
    public readonly authorName: string,
    public readonly content: string,
    public readonly authorAvatarUrl?: string | undefined,
    public readonly parentId?: string | null,
  ) {}
}
