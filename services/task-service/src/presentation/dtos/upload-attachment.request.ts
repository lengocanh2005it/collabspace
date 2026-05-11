// src/presentation/dtos/upload-attachment.request.ts
import { IsUUID, IsNotEmpty } from 'class-validator';

export class UploadAttachmentRequest {
  @IsUUID()
  @IsNotEmpty()
  taskId!: string;

  // File will be handled by @UploadedFile() decorator
  file?: any; // Express.Multer.File from multer middleware
}
