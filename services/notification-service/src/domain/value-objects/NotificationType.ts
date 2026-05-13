// src/domain/value-objects/NotificationType.ts

/**
 * Notification Type Enum
 * Định nghĩa các loại thông báo trong hệ thống
 */
export enum NotificationType {
  // Task Events
  TASK_ASSIGNED = "TASK_ASSIGNED", // Khi người dùng được gán task
  TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED", // Khi status của task thay đổi
  TASK_DUE_DATE_APPROACHING = "TASK_DUE_DATE_APPROACHING", // Nhắc nhở deadline
  TASK_DELETED = "TASK_DELETED", // Khi task bị xóa

  // Comment Events
  TASK_COMMENT = "COMMENT_ADDED", // Khi có comment mới trên task
  COMMENT_REPLIED = "COMMENT_REPLIED", // Khi có reply trên comment của bạn
  COMMENT_MENTIONED = "COMMENT_MENTIONED", // Khi bạn được mention trong comment
  COMMENT_EDITED = "COMMENT_EDITED", // Khi comment được edit
  COMMENT_DELETED = "COMMENT_DELETED", // Khi comment bị xóa

  // Attachment Events
  ATTACHMENT_ADDED = "ATTACHMENT_ADDED", // Khi có file đính kèm mới

  // Workspace Events
  WORKSPACE_INVITED = "WORKSPACE_INVITED", // Khi được invite vào workspace
  WORKSPACE_MEMBER_JOINED = "WORKSPACE_MEMBER_JOINED",
  WORKSPACE_MEMBER_LEFT = "WORKSPACE_MEMBER_LEFT",

  // System Events
  SYSTEM_ALERT = "SYSTEM_ALERT", // Thông báo từ hệ thống
}
