import { TaskCommentNotificationPublisher } from "./task-comment-notification.publisher";
import { TaskOutboxService } from "../../infrastructure/outbox/task-outbox.service";

describe("TaskCommentNotificationPublisher", () => {
  let publisher: TaskCommentNotificationPublisher;
  let mockTaskOutboxService: jest.Mocked<
    Pick<
      TaskOutboxService,
      | "enqueueTaskCommented"
      | "enqueueCommentMentioned"
      | "enqueueCommentMentionedBatch"
    >
  >;

  beforeEach(() => {
    mockTaskOutboxService = {
      enqueueTaskCommented: jest.fn().mockResolvedValue(undefined),
      enqueueCommentMentioned: jest.fn().mockResolvedValue(undefined),
      enqueueCommentMentionedBatch: jest.fn().mockResolvedValue(undefined),
    };

    publisher = new TaskCommentNotificationPublisher(
      mockTaskOutboxService as unknown as TaskOutboxService,
    );
  });

  it("notifies assignee and batch enqueues mention notifications", async () => {
    await publisher.publishForNewComment({
      taskId: "task-1",
      taskTitle: "Task title",
      assigneeId: "assignee-1",
      authorId: "author-1",
      authorName: "Author",
      authorAvatarUrl: "avatar-url",
      commentId: "comment-1",
      content: "Hello @user-2 and @user-3",
      mentionedUserIds: ["user-2", "user-3"],
    });

    expect(mockTaskOutboxService.enqueueTaskCommented).toHaveBeenCalledTimes(1);
    expect(mockTaskOutboxService.enqueueCommentMentionedBatch).toHaveBeenCalledWith(
      [
        expect.objectContaining({ recipientId: "user-2" }),
        expect.objectContaining({ recipientId: "user-3" }),
      ],
    );
    expect(mockTaskOutboxService.enqueueCommentMentioned).not.toHaveBeenCalled();
  });

  it("skips mention batch when there are no mention recipients", async () => {
    await publisher.publishForNewComment({
      taskId: "task-1",
      taskTitle: "Task title",
      assigneeId: "assignee-1",
      authorId: "author-1",
      authorName: "Author",
      authorAvatarUrl: "avatar-url",
      commentId: "comment-1",
      content: "No mentions",
      mentionedUserIds: [],
    });

    expect(mockTaskOutboxService.enqueueCommentMentionedBatch).not.toHaveBeenCalled();
  });
});
