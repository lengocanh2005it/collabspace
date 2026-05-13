// src/infrastructure/mappers/TaskMapper.ts

import { Task as TaskDomain } from "../../domain/entities/Task";
import { TaskPersistence } from "../persistence/task.schema";
import { TaskId } from "../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";

export class TaskMapper {
  static toPersistence(domainTask: TaskDomain): any {
    return {
      _id: domainTask.getId().getValue(),
      title: domainTask.getTitle(),
      description: domainTask.getDescription(),
      status: domainTask.getStatus().getValue(),
      workspaceId: domainTask.getWorkspaceId(),
      assigneeId: domainTask.getAssigneeId(),

      // 👇 Dùng luôn toPlainObject() cho lẹ và sạch code
      createdBy: domainTask.getCreatedBy().toPlainObject(),
      assignedTo: domainTask.getAssignedTo()
        ? domainTask.getAssignedTo()!.toPlainObject()
        : null,

      attachments: domainTask.getAttachments(),
      createdAt: domainTask.getCreatedAt(),
      updatedAt: domainTask.getUpdatedAt(),
    };
  }

  static toDomain(rawDoc: any): TaskDomain {
    const taskId = new TaskId(rawDoc._id);

    // 👇 Truyền đủ 5 tham số từ DB lên để dựng lại Snapshot
    const creator = UserSnapshot.create(
      rawDoc.createdBy.userId,
      rawDoc.createdBy.email,
      rawDoc.createdBy.fullName,
      rawDoc.createdBy.displayName,
      rawDoc.createdBy.avatarUrl,
    );

    const assignedTo = rawDoc.assignedTo
      ? UserSnapshot.create(
          rawDoc.assignedTo.userId,
          rawDoc.assignedTo.email,
          rawDoc.assignedTo.fullName,
          rawDoc.assignedTo.displayName,
          rawDoc.assignedTo.avatarUrl,
        )
      : null;

    return TaskDomain.restore(
      taskId,
      rawDoc.title,
      rawDoc.description || "",
      rawDoc.status,
      rawDoc.workspaceId,
      rawDoc.assigneeId || null,
      assignedTo,
      creator,
      new Date(rawDoc.createdAt),
      new Date(rawDoc.updatedAt),
      rawDoc.attachments || [],
    );
  }

  // Chuyển đổi từ Domain Entity sang Response DTO
  static toResponse(domainTask: TaskDomain): any {
    return {
      id: domainTask.getId().getValue(),
      title: domainTask.getTitle(),
      description: domainTask.getDescription(),
      status: domainTask.getStatus().getValue(),
      workspaceId: domainTask.getWorkspaceId(),
      assigneeId: domainTask.getAssigneeId(),

      // 👇 Trả về Response cũng dùng form chuẩn 5 tham số
      createdBy: domainTask.getCreatedBy().toPlainObject(),
      assignedTo: domainTask.getAssignedTo()
        ? domainTask.getAssignedTo()!.toPlainObject()
        : null,

      attachments: domainTask.getAttachments(),
      createdAt: domainTask.getCreatedAt(),
      updatedAt: domainTask.getUpdatedAt(),
    };
  }
}
