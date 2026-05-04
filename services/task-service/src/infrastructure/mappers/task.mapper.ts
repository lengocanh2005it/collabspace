// src/infrastructure/mappers/TaskMapper.ts

import { Task as TaskDomain } from '../../domain/entities/Task';
import { TaskPersistence } from '../persistence/task.schema';
import { TaskId } from '../../domain/value-objects/TaskId';
import { UserSnapshot } from '../../domain/value-objects/UserSnapshot';

export class TaskMapper {
  
  static toPersistence(domainTask: TaskDomain): any {
    return {
      _id: domainTask.getId().getValue(),
      title: domainTask.getTitle(),
      description: domainTask.getDescription(),
      status: domainTask.getStatus().getValue(),
      workspaceId: domainTask.getWorkspaceId(),
      assigneeId: domainTask.getAssigneeId(),
      createdBy: {
        userId: domainTask.getCreatedBy().getUserId(),
        name: domainTask.getCreatedBy().getName(),
        avatarUrl: domainTask.getCreatedBy().getAvatarUrl(),
      },
      assignedTo: domainTask.getAssignedTo()
        ? {
            userId: domainTask.getAssignedTo()!.getUserId(),
            name: domainTask.getAssignedTo()!.getName(),
            avatarUrl: domainTask.getAssignedTo()!.getAvatarUrl(),
          }
        : null,
      attachments: domainTask.getAttachments(),
      createdAt: domainTask.getCreatedAt(),
      updatedAt: domainTask.getUpdatedAt(),
    };
  }

  static toDomain(rawDoc: TaskPersistence): TaskDomain {
    const taskId = new TaskId(rawDoc._id);
    const creator = UserSnapshot.create(
      rawDoc.createdBy.userId,
      rawDoc.createdBy.name,
      rawDoc.createdBy.avatarUrl
    );

    const assignedTo = rawDoc.assignedTo
      ? UserSnapshot.create(
          rawDoc.assignedTo.userId,
          rawDoc.assignedTo.name,
          rawDoc.assignedTo.avatarUrl
        )
      : null;

    return TaskDomain.restore(
      taskId,
      rawDoc.title,
      rawDoc.description || '',
      rawDoc.status,
      rawDoc.workspaceId,
      rawDoc.assigneeId || null,
      assignedTo,
      creator,
      new Date(rawDoc.createdAt),
      new Date(rawDoc.updatedAt),
      rawDoc.attachments || []
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
      createdBy: {
        userId: domainTask.getCreatedBy().getUserId(),
        name: domainTask.getCreatedBy().getName(),
        avatarUrl: domainTask.getCreatedBy().getAvatarUrl(),
      },
      assignedTo: domainTask.getAssignedTo()
        ? {
            userId: domainTask.getAssignedTo()!.getUserId(),
            name: domainTask.getAssignedTo()!.getName(),
            avatarUrl: domainTask.getAssignedTo()!.getAvatarUrl(),
          }
        : null,
      attachments: domainTask.getAttachments(),
      createdAt: domainTask.getCreatedAt(),
      updatedAt: domainTask.getUpdatedAt(),
    };
  }
}