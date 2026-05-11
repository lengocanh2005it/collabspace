// src/application/commands/create-task.command.ts
export class CreateTaskCommand {
  constructor(
    public readonly title: string,
    public readonly description: string,
    public readonly creatorId: string,
    public readonly creatorName: string,
    public readonly workspaceId: string
  ) {}
}