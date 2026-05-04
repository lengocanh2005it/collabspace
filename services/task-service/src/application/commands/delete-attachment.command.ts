// src/application/commands/delete-attachment.command.ts
export class DeleteAttachmentCommand {
  constructor(
    public readonly taskId: string,
    public readonly fileUrl: string,
  ) {}
}
