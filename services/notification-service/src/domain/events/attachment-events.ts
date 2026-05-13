// src/domain/events/attachment-events.ts

/**
 * Attachment-related Event Payloads
 * Events triggered when attachment operations occur
 */

export interface AttachmentAddedEventPayload {
  attachmentId: string;
  taskId: string;
  taskTitle: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedByAvatarUrl?: string;
  fileName: string;
  fileSize: number;
  fileType: string; // 'image', 'document', 'video', etc.
  fileUrl?: string; // Pre-signed URL if applicable
  workspaceId: string;
  taskAssigneeId?: string; // Notify người được gán task
}

export interface AttachmentDeletedEventPayload {
  attachmentId: string;
  taskId: string;
  taskTitle: string;
  fileName: string;
  deletedBy: string;
  deletedByName: string;
  workspaceId: string;
}

export interface AttachmentDownloadedEventPayload {
  attachmentId: string;
  taskId: string;
  taskTitle: string;
  fileName: string;
  downloadedBy: string;
  downloadedByName: string;
  downloadCount: number;
  workspaceId: string;
}
