// src/infrastructure/mappers/TaskMapper.ts

import { Task as TaskDomain } from "../../domain/entities/Task";
import type {
  TaskDocument,
  TaskPersistence,
  TaskUserSnapshotPersistence,
} from "../persistence/task.schema";
import { TaskId } from "../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";
import type {
  TaskResponseData,
  TaskUserResponse,
} from "../../presentation/dtos/task.response";

export class TaskMapper {
  private static toSnapshotPersistence(
    snapshot: UserSnapshot,
  ): TaskUserSnapshotPersistence {
    return {
      userId: snapshot.getUserId(),
      email: snapshot.getEmail(),
      fullName: snapshot.getFullName(),
      displayName: snapshot.getDisplayName(),
      avatarUrl: snapshot.getAvatarUrl(),
    };
  }

  private static toResponseUser(snapshot: UserSnapshot): TaskUserResponse {
    return {
      userId: snapshot.getUserId(),
      email: snapshot.getEmail(),
      fullName: snapshot.getFullName(),
      displayName: snapshot.getDisplayName(),
      avatarUrl: snapshot.getAvatarUrl(),
    };
  }

  static toPersistence(domainTask: TaskDomain): TaskPersistence {
    return {
      _id: domainTask.getId().getValue(),
      title: domainTask.getTitle(),
      description: domainTask.getDescription(),
      status: domainTask.getStatus().getValue(),
      workspaceId: domainTask.getWorkspaceId(),
      projectId: domainTask.getProjectId(),
      priority: domainTask.getPriority().getValue(),
      dueDate: domainTask.getDueDate(),
      labels: domainTask.getLabels(),
      assigneeId: domainTask.getAssigneeId(),

      // 👇 Dùng payload typed rõ ràng để tránh trôi schema giữa các layer
      createdBy: this.toSnapshotPersistence(domainTask.getCreatedBy()),
      assignedTo: domainTask.getAssignedTo()
        ? this.toSnapshotPersistence(domainTask.getAssignedTo()!)
        : null,

      attachments: domainTask.getAttachments(),
      createdAt: domainTask.getCreatedAt(),
      updatedAt: domainTask.getUpdatedAt(),
    };
  }

  static toDomain(rawDoc: TaskDocument, streamVersion = 0): TaskDomain {
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
      rawDoc.projectId || null,
      rawDoc.assigneeId || null,
      assignedTo,
      creator,
      new Date(rawDoc.createdAt),
      new Date(rawDoc.updatedAt),
      rawDoc.attachments || [],
      streamVersion,
      rawDoc.priority ?? "MEDIUM",
      rawDoc.dueDate ? new Date(rawDoc.dueDate) : null,
      rawDoc.labels ?? [],
    );
  }

  // Chuyển đổi từ Domain Entity sang Response DTO
  static toResponse(domainTask: TaskDomain): TaskResponseData {
    return {
      id: domainTask.getId().getValue(),
      title: domainTask.getTitle(),
      description: domainTask.getDescription(),
      status: domainTask.getStatus().getValue(),
      workspaceId: domainTask.getWorkspaceId(),
      projectId: domainTask.getProjectId(),
      priority: domainTask.getPriority().getValue(),
      dueDate: domainTask.getDueDate(),
      labels: domainTask.getLabels(),
      assigneeId: domainTask.getAssigneeId(),

      // 👇 Trả về response typed rõ ràng thay vì object any
      createdBy: this.toResponseUser(domainTask.getCreatedBy()),
      assignedTo: domainTask.getAssignedTo()
        ? this.toResponseUser(domainTask.getAssignedTo()!)
        : null,

      attachments: domainTask.getAttachments(),
      createdAt: domainTask.getCreatedAt(),
      updatedAt: domainTask.getUpdatedAt(),
    };
  }
}
