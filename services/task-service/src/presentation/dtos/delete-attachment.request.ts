// src/presentation/dtos/delete-attachment.request.ts
import { IsUUID, IsUrl, IsNotEmpty } from "class-validator";

export class DeleteAttachmentRequest {
  @IsUUID()
  @IsNotEmpty()
  taskId!: string;

  @IsUrl()
  @IsNotEmpty()
  fileUrl!: string;
}
