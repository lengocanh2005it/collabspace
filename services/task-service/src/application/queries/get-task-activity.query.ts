// src/application/queries/get-task-activity.query.ts
export class GetTaskActivityQuery {
  constructor(
    public readonly taskId: string,
    public readonly limit: number = 50,
    public readonly offset: number = 0,
  ) {}
}
