// src/presentation/dtos/upload-attachment.request.ts
import { IsUUID, IsNotEmpty } from "class-validator";
import type { UploadedFile } from "../../common/types/uploaded-file";

export class UploadAttachmentRequest {
  @IsUUID()
  @IsNotEmpty()
  taskId!: string;

  // File will be handled by @UploadedFile() decorator
  file?: UploadedFile;
}
