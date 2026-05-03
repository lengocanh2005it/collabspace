// src/application/commands/assign-task.command.ts
export class AssignTaskCommand {
  constructor(
    public readonly taskId: string,
    public readonly assigneeId: string | null,
    public readonly assigneeName?: string,
    public readonly assigneeAvatarUrl?: string
  ) {}
}
