// src/application/commands/change-task-status.command.ts
export class ChangeTaskStatusCommand {
  constructor(
    public readonly taskId: string,
    public readonly newStatus: string,
  ) {}
}
