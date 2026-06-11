// src/application/usecases/get-task-activity.handler.ts
import { QueryHandler, IQueryHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { GetTaskActivityQuery } from "../queries/get-task-activity.query";
import { ITaskEventStore } from "../ports/ITaskEventStore";
import { COMMENT_REPOSITORY_TOKEN } from "../../domain/repositories/comment.repository.interface";
import type { ICommentRepository } from "../../domain/repositories/comment.repository.interface";
import {
  TaskDomainEventType,
  type TaskCreatedPayload,
  type TaskDetailsUpdatedPayload,
  type TaskStatusChangedPayload,
  type TaskAssigneeChangedPayload,
  type TaskAttachmentAddedPayload,
  type TaskAttachmentRemovedPayload,
} from "../../domain/events/task-domain.events";
import {
  TaskActivityResponse,
  type TaskActivityItemData,
  type ActivityEventType,
} from "../../presentation/dtos/task-activity.response";

@QueryHandler(GetTaskActivityQuery)
export class GetTaskActivityHandler implements IQueryHandler<GetTaskActivityQuery> {
  constructor(
    @Inject(ITaskEventStore)
    private readonly eventStore: ITaskEventStore,
    @Inject(COMMENT_REPOSITORY_TOKEN)
    private readonly commentRepo: ICommentRepository,
  ) {}

  async execute(query: GetTaskActivityQuery): Promise<TaskActivityResponse> {
    const [events, comments] = await Promise.all([
      this.eventStore.loadStream(query.taskId),
      this.commentRepo.findByTaskIdAsync(query.taskId),
    ]);

    const items: TaskActivityItemData[] = [];

    for (const ev of events) {
      const item = this.mapEvent(
        ev.eventId,
        ev.eventType,
        ev.payload as unknown as Record<string, unknown>,
        new Date(ev.occurredAt),
      );
      if (item) items.push(item);
    }

    for (const comment of comments) {
      items.push({
        id: comment.getId(),
        type: "comment_added",
        actorId: comment.getAuthorId(),
        actorName: comment.getAuthorName(),
        actorAvatarUrl: comment.getAuthorAvatarUrl() ?? null,
        summary: this.truncate(comment.getContent(), 120),
        meta: { commentId: comment.getId() },
        occurredAt: comment.getCreatedAt().toISOString(),
      });
    }

    items.sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );

    const total = items.length;
    const paged = items.slice(query.offset, query.offset + query.limit);

    return new TaskActivityResponse(paged, total);
  }

  private mapEvent(
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
          summary: `Updated task details`,
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

  private truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + "…" : text;
  }
}
