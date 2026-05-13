// src/application/queries/get-tasks.query.ts
export class GetTasksQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly status?: string,
    public readonly assigneeId?: string,
  ) {}
}
