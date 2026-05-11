// src/application/commands/upload-attachment.command.ts
import type { Express } from 'express';

export class UploadAttachmentCommand {
  constructor(
    public readonly taskId: string,
    public readonly file: any, // Express.Multer.File type from multer middleware
  ) {}
}
