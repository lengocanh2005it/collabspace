// src/application/usecases/comments/get/get-task-comments.query.ts

export class GetTaskCommentsQuery {
  constructor(
    public readonly taskId: string,
    public readonly skip: number = 0,
    public readonly limit: number = 20,
  ) {}
}
