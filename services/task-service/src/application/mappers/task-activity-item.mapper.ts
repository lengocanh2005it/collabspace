// src/application/mappers/task-activity-item.mapper.ts
import { Comment } from "../../domain/entities/comment.entity";
import {
  TaskDomainEventType,
  type StoredTaskDomainEvent,
  type TaskAssigneeChangedPayload,
  type TaskAttachmentAddedPayload,
  type TaskAttachmentRemovedPayload,
  type TaskCreatedPayload,
  type TaskDetailsUpdatedPayload,
  type TaskStatusChangedPayload,
} from "../../domain/events/task-domain.events";
import type { TaskActivityItemData } from "../../presentation/dtos/task-activity.response";

export class TaskActivityItemMapper {
  static fromStoredEvents(
    events: StoredTaskDomainEvent[],
  ): TaskActivityItemData[] {
    const items: TaskActivityItemData[] = [];

    for (const event of events) {
      const item = this.fromStoredEvent(event);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  static fromStoredEvent(
    event: StoredTaskDomainEvent,
  ): TaskActivityItemData | null {
    return this.mapEvent(
      event.eventId,
      event.eventType,
      event.payload as unknown as Record<string, unknown>,
      new Date(event.occurredAt),
    );
  }

  static fromComment(comment: Comment): TaskActivityItemData {
    return {
      id: comment.getId(),
      type: "comment_added",
      actorId: comment.getAuthorId(),
      actorName: comment.getAuthorName(),
      actorAvatarUrl: comment.getAuthorAvatarUrl() ?? null,
      summary: this.truncate(comment.getContent(), 120),
      meta: { commentId: comment.getId() },
      occurredAt: comment.getCreatedAt().toISOString(),
    };
  }

  private static mapEvent(
    id: string,
    eventType: string,
    payload: Record<string, unknown>,
    occurredAt: Date,
  ): TaskActivityItemData | null {
    const ts =
      occurredAt instanceof Date
        ? occurredAt.toISOString()
        : String(occurredAt);

    switch (eventType) {
      case TaskDomainEventType.TaskCreated: {
        const p = payload as unknown as TaskCreatedPayload;
        return {
          id,
          type: "task_created",
          actorId: p.createdBy?.userId ?? null,
          actorName: p.createdBy?.displayName ?? p.createdBy?.fullName ?? null,
          actorAvatarUrl: p.createdBy?.avatarUrl ?? null,
          summary: `Created task "${p.title}"`,
          meta: { title: p.title, status: p.status },
          occurredAt: ts,
        };
      }

      case TaskDomainEventType.TaskDetailsUpdated: {
        const p = payload as unknown as TaskDetailsUpdatedPayload;
        return {
          id,
          type: "task_details_updated",
          actorId: null,
          actorName: null,
          actorAvatarUrl: null,
          summary: "Updated task details",
          meta: { title: p.title, priority: p.priority },
          occurredAt: ts,
        };
      }

      case TaskDomainEventType.TaskStatusChanged: {
        const p = payload as unknown as TaskStatusChangedPayload;
        return {
          id,
          type: "task_status_changed",
          actorId: null,
          actorName: null,
          actorAvatarUrl: null,
          summary: `Status changed from ${p.previousStatus} to ${p.status}`,
          meta: { from: p.previousStatus, to: p.status },
          occurredAt: ts,
        };
      }

      case TaskDomainEventType.TaskAssigneeChanged: {
        const p = payload as unknown as TaskAssigneeChangedPayload;
        const assigneeName =
          p.assignedTo?.displayName ?? p.assignedTo?.fullName ?? null;
        return {
          id,
          type: "task_assignee_changed",
          actorId: p.assignedTo?.userId ?? null,
          actorName: assigneeName,
          actorAvatarUrl: p.assignedTo?.avatarUrl ?? null,
          summary: assigneeName
            ? `Assigned to ${assigneeName}`
            : "Assignee removed",
          meta: { assigneeId: p.assigneeId },
          occurredAt: ts,
        };
      }

      case TaskDomainEventType.TaskAttachmentAdded: {
        const p = payload as unknown as TaskAttachmentAddedPayload;
        return {
          id,
          type: "task_attachment_added",
          actorId: null,
          actorName: null,
          actorAvatarUrl: null,
          summary: "Attachment added",
          meta: { fileUrl: p.fileUrl },
          occurredAt: ts,
        };
      }

      case TaskDomainEventType.TaskAttachmentRemoved: {
        const p = payload as unknown as TaskAttachmentRemovedPayload;
        return {
          id,
          type: "task_attachment_removed",
          actorId: null,
          actorName: null,
          actorAvatarUrl: null,
          summary: "Attachment removed",
          meta: { fileUrl: p.fileUrl },
          occurredAt: ts,
        };
      }

      default:
        return null;
    }
  }

  private static truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + "…" : text;
  }
}
