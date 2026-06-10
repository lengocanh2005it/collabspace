// src/application/commands/update-task-details.command.ts
export class UpdateTaskDetailsCommand {
  constructor(
    public readonly taskId: string,
    public readonly title: string,
    public readonly description: string,
    public readonly priority?: string,
    public readonly dueDate?: Date | null,
    public readonly labels?: string[],
  ) {}
}
