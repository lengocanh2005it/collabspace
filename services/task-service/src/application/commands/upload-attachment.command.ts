// src/application/commands/upload-attachment.command.ts
import type { UploadedFile } from "../../common/types/uploaded-file";

export class UploadAttachmentCommand {
  constructor(
    public readonly taskId: string,
    public readonly file: UploadedFile,
  ) {}
}
