// src/presentation/dtos/upload-attachment.response.ts
export class UploadAttachmentResponse {
  fileUrl!: string;
  fileName!: string;
  fileSize!: number;
  uploadedAt?: Date;
}
