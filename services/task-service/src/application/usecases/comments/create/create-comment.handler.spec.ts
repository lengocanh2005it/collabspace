import { BadRequestException } from "@nestjs/common";
import { CreateCommentHandler } from "./create-comment.handler";
import { CreateCommentCommand } from "./create-comment.command";
import type { ITaskRepository } from "../../../ports/ITaskRepository";
import { createMockTaskRepository } from "../../../../test-utils/mock-task-repository";
import type { UserReplicaLookupService } from "../../../services/user-replica-lookup.service";
import type { ICommentRepository } from "../../../../domain/repositories/comment.repository.interface";
import type { TaskCommentNotificationPublisher } from "../../../services/task-comment-notification.publisher";
import type { ITaskActivityRepository } from "../../../ports/ITaskActivityRepository";
import { Task } from "../../../../domain/entities/Task";
import { TaskId } from "../../../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../../../domain/value-objects/UserSnapshot";
import type { UserReplica } from "../../../../infrastructure/persistence/user-replica.schema";

describe("CreateCommentHandler", () => {
  let handler: CreateCommentHandler;
  let mockCommentRepo: jest.Mocked<ICommentRepository>;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;
  let mockUserReplicaLookup: jest.Mocked<
    Pick<UserReplicaLookupService, "findActiveByIdAsync" | "findActiveByUsernameAsync">
  >;
  let mockCommentNotificationPublisher: jest.Mocked<TaskCommentNotificationPublisher>;
  let mockTaskActivityRepository: jest.Mocked<ITaskActivityRepository>;

  beforeEach(() => {
    mockCommentRepo = {
      createAsync: jest.fn(),
      getTaskCommentsAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      deleteAsync: jest.fn(),
      updateAsync: jest.fn(),
    };

    mockTaskRepo = createMockTaskRepository();

    mockUserReplicaLookup = {
      findActiveByIdAsync: jest.fn(),
      findActiveByUsernameAsync: jest.fn(),
    };

    mockCommentNotificationPublisher = {
      publishForNewComment: jest.fn(),
    } as any;

    mockTaskActivityRepository = {
      appendFromEventsAsync: jest.fn(),
      appendFromCommentAsync: jest.fn().mockResolvedValue(undefined),
      findByTaskIdAsync: jest.fn(),
      countByTaskIdAsync: jest.fn(),
    };

    handler = new CreateCommentHandler(
      mockCommentRepo,
      mockTaskRepo,
      mockUserReplicaLookup as UserReplicaLookupService,
      mockCommentNotificationPublisher,
      mockTaskActivityRepository,
    );
  });

  const createMockTask = (assigneeId: string | null) => {
    const creatorSnapshot = UserSnapshot.create("creator-1", "c@c.c", "Creator", "Creator", "url");
    return Task.restore(
      new TaskId("123e4567-e89b-12d3-a456-426614174000"),
      "Task Title",
      "Desc",
      "TODO",
      "workspace-1",
      null,
      assigneeId,
      assigneeId ? UserSnapshot.create(assigneeId, "a@a.c", "Assignee", "Assignee", "url") : null,
      creatorSnapshot,
      new Date(),
      new Date(),
      [],
    );
  };

  const createMockReplica = (id: string, active: boolean): UserReplica => ({
    userId: id,
    email: `${id}@test.com`,
    fullName: `Name ${id}`,
    displayName: `Display ${id}`,
    avatarUrl: "url",
    isActive: active,
    lastSyncedAt: new Date(),
  });

  it("should create comment and emit event if task has an assignee different from author", async () => {
    const command = new CreateCommentCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "author-1",
      "Great task!",
    );
    const task = createMockTask("assignee-1");
    const authorReplica = createMockReplica("author-1", true);

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);
    mockUserReplicaLookup.findActiveByIdAsync.mockResolvedValue(authorReplica);
    mockCommentRepo.createAsync.mockResolvedValue("123e4567-e89b-12d3-a456-426614174001");

    const result = await handler.execute(command);

    expect(result.commentId).toBe("123e4567-e89b-12d3-a456-426614174001");
    expect(mockCommentRepo.createAsync).toHaveBeenCalledTimes(1);
    expect(mockTaskActivityRepository.appendFromCommentAsync).toHaveBeenCalledTimes(1);
    expect(mockCommentNotificationPublisher.publishForNewComment).toHaveBeenCalledTimes(1);
    expect(mockCommentNotificationPublisher.publishForNewComment).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        assigneeId: "assignee-1",
        authorId: "author-1",
      }),
    );
  });

  it("should create comment but NOT emit event if task has NO assignee", async () => {
    const command = new CreateCommentCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "author-1",
      "Great task!",
    );
    const task = createMockTask(null);
    const authorReplica = createMockReplica("author-1", true);

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);
    mockUserReplicaLookup.findActiveByIdAsync.mockResolvedValue(authorReplica);
    mockCommentRepo.createAsync.mockResolvedValue("123e4567-e89b-12d3-a456-426614174001");

    await handler.execute(command);

    expect(mockCommentRepo.createAsync).toHaveBeenCalledTimes(1);
    expect(mockTaskActivityRepository.appendFromCommentAsync).toHaveBeenCalledTimes(1);
    expect(mockCommentNotificationPublisher.publishForNewComment).toHaveBeenCalledTimes(1);
  });

  it("should create comment but NOT emit event if author IS the assignee", async () => {
    const command = new CreateCommentCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "author-1",
      "Self note",
    );
    const task = createMockTask("author-1"); // Assignee is author
    const authorReplica = createMockReplica("author-1", true);

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);
    mockUserReplicaLookup.findActiveByIdAsync.mockResolvedValue(authorReplica);
    mockCommentRepo.createAsync.mockResolvedValue("123e4567-e89b-12d3-a456-426614174001");

    await handler.execute(command);

    expect(mockCommentRepo.createAsync).toHaveBeenCalledTimes(1);
    expect(mockTaskActivityRepository.appendFromCommentAsync).toHaveBeenCalledTimes(1);
    expect(mockCommentNotificationPublisher.publishForNewComment).toHaveBeenCalledTimes(1);
  });

  it("should throw BadRequestException if task does not exist", async () => {
    const command = new CreateCommentCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "author-1",
      "Great task!",
    );
    mockTaskRepo.findByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    expect(mockCommentRepo.createAsync).not.toHaveBeenCalled();
  });

  it("should throw BadRequestException if author does not exist or inactive", async () => {
    const command = new CreateCommentCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "author-1",
      "Great task!",
    );
    const task = createMockTask("assignee-1");

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);
    mockUserReplicaLookup.findActiveByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    expect(mockCommentRepo.createAsync).not.toHaveBeenCalled();
  });
});
