import { TaskActivityItemMapper } from "./task-activity-item.mapper";
import { Comment } from "../../domain/entities/comment.entity";
import {
  TaskDomainEventType,
  type StoredTaskDomainEvent,
} from "../../domain/events/task-domain.events";

describe("TaskActivityItemMapper", () => {
  it("maps task created events", () => {
    const event: StoredTaskDomainEvent = {
      streamId: "task-1",
      version: 1,
      eventId: "event-1",
      eventType: TaskDomainEventType.TaskCreated,
      occurredAt: "2026-01-15T08:00:00.000Z",
      payload: {
        title: "Demo task",
        description: "Desc",
        status: "TODO",
        workspaceId: "workspace-1",
        projectId: null,
        priority: "MEDIUM",
        dueDate: null,
        labels: [],
        createdBy: {
          userId: "creator-1",
          email: "creator@test.com",
          fullName: "Creator",
          displayName: "Creator",
          avatarUrl: null,
        },
        createdAt: "2026-01-15T08:00:00.000Z",
      },
    };

    const item = TaskActivityItemMapper.fromStoredEvent(event);

    expect(item).toEqual(
      expect.objectContaining({
        id: "event-1",
        type: "task_created",
        actorId: "creator-1",
        summary: 'Created task "Demo task"',
      }),
    );
  });

  it("maps comments", () => {
    const comment = Comment.create(
      "comment-1",
      "task-1",
      "author-1",
      "Author",
      "avatar",
      "Hello team",
    );

    const item = TaskActivityItemMapper.fromComment(comment);

    expect(item).toEqual(
      expect.objectContaining({
        id: "comment-1",
        type: "comment_added",
        actorId: "author-1",
        summary: "Hello team",
      }),
    );
  });
});
