import { BadRequestException } from "@nestjs/common";
import { CreateCommentHandler } from "./create-comment.handler";
import { CreateCommentCommand } from "./create-comment.command";
import { ITaskRepository } from "../../../ports/ITaskRepository";
import { IUserReplicaRepository } from "../../../ports/IUserReplicaRepository";
import { ICommentRepository } from "../../../../domain/repositories/comment.repository.interface";
import { TaskOutboxService } from "../../../../infrastructure/outbox/task-outbox.service";
import { Task } from "../../../../domain/entities/Task";
import { TaskId } from "../../../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../../../domain/value-objects/UserSnapshot";
import { UserReplica } from "../../../../infrastructure/persistence/user-replica.schema";
import { Comment } from "../../../../domain/entities/comment.entity";

describe("CreateCommentHandler", () => {
  let handler: CreateCommentHandler;
  let mockCommentRepo: jest.Mocked<ICommentRepository>;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;
  let mockUserReplicaRepo: jest.Mocked<IUserReplicaRepository>;
  let mockTaskOutboxService: jest.Mocked<TaskOutboxService>;

  beforeEach(() => {
    mockCommentRepo = {
      createAsync: jest.fn(),
      getTaskCommentsAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      deleteAsync: jest.fn(),
      updateAsync: jest.fn(),
    };

    mockTaskRepo = {
      addAsync: jest.fn(),
      updateAsync: jest.fn(),
      deleteAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      findByWorkspaceIdAsync: jest.fn(),
    };

    mockUserReplicaRepo = {
      addAsync: jest.fn(),
      updateAsync: jest.fn(),
      findByIdAsync: jest.fn(),
    };

    mockTaskOutboxService = {
      enqueueTaskAssigned: jest.fn(),
      enqueueTaskCommented: jest.fn(),
    } as any;

    handler = new CreateCommentHandler(
      mockCommentRepo,
      mockTaskRepo,
      mockUserReplicaRepo,
      mockTaskOutboxService,
    );
  });

  const createMockTask = (assigneeId: string | null) => {
    const creatorSnapshot = UserSnapshot.create(
      "creator-1",
      "c@c.c",
      "Creator",
      "Creator",
      "url",
    );
    return Task.restore(
      new TaskId("123e4567-e89b-12d3-a456-426614174000"),
      "Task Title",
      "Desc",
      "TODO",
      "workspace-1",
      assigneeId,
      assigneeId
        ? UserSnapshot.create(
            assigneeId,
            "a@a.c",
            "Assignee",
            "Assignee",
            "url",
          )
        : null,
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
    mockUserReplicaRepo.findByIdAsync.mockResolvedValue(authorReplica);
    mockCommentRepo.createAsync.mockResolvedValue(
      "123e4567-e89b-12d3-a456-426614174001",
    );

    const result = await handler.execute(command);

    expect(result.commentId).toBe("123e4567-e89b-12d3-a456-426614174001");
    expect(mockCommentRepo.createAsync).toHaveBeenCalledTimes(1);
    expect(mockTaskOutboxService.enqueueTaskCommented).toHaveBeenCalledTimes(1);
    expect(mockTaskOutboxService.enqueueTaskCommented).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        recipientId: "assignee-1",
        actorId: "author-1",
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
    mockUserReplicaRepo.findByIdAsync.mockResolvedValue(authorReplica);
    mockCommentRepo.createAsync.mockResolvedValue(
      "123e4567-e89b-12d3-a456-426614174001",
    );

    await handler.execute(command);

    expect(mockCommentRepo.createAsync).toHaveBeenCalledTimes(1);
    expect(mockTaskOutboxService.enqueueTaskCommented).not.toHaveBeenCalled();
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
    mockUserReplicaRepo.findByIdAsync.mockResolvedValue(authorReplica);
    mockCommentRepo.createAsync.mockResolvedValue(
      "123e4567-e89b-12d3-a456-426614174001",
    );

    await handler.execute(command);

    expect(mockCommentRepo.createAsync).toHaveBeenCalledTimes(1);
    expect(mockTaskOutboxService.enqueueTaskCommented).not.toHaveBeenCalled();
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
    const authorReplica = createMockReplica("author-1", false); // INACTIVE

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);
    mockUserReplicaRepo.findByIdAsync.mockResolvedValue(authorReplica);

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    expect(mockCommentRepo.createAsync).not.toHaveBeenCalled();
  });
});
