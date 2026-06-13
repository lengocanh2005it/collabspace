import { Task } from "./Task";
import { TaskId } from "../value-objects/TaskId";
import { UserSnapshot } from "../value-objects/UserSnapshot";
import {
  StoredTaskDomainEvent,
  TaskDomainEventType,
} from "../events/task-domain.events";
import { BusinessRuleException } from "../exceptions/BusinessRuleException";

describe("Task (event-sourced aggregate)", () => {
  const taskId = new TaskId("123e4567-e89b-12d3-a456-426614174000");
  const creator = UserSnapshot.create(
    "creator-1",
    "creator@test.com",
    "Creator",
    "Creator",
    null,
  );

  const toStored = (
    event: ReturnType<Task["getUncommittedEvents"]>[number],
    version: number,
  ): StoredTaskDomainEvent => ({
    ...event,
    streamId: taskId.getValue(),
    version,
  });

  it("emits TaskCreated when created", () => {
    const task = Task.create(
      taskId,
      "Title",
      "Description",
      "workspace-1",
      creator,
    );

    const events = task.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(TaskDomainEventType.TaskCreated);
    expect(task.getTitle()).toBe("Title");
    expect(task.getStatus().getValue()).toBe("TODO");
  });

  it("rehydrates from event history", () => {
    const created = Task.create(
      taskId,
      "Title",
      "Description",
      "workspace-1",
      creator,
    );
    created.changeStatus("DOING");
    created.updateDetails("Updated", "New desc");

    const history = [...created.getUncommittedEvents()].map((event, index) =>
      toStored(event, index + 1),
    );

    const rehydrated = Task.fromHistory(history);
    expect(rehydrated.getTitle()).toBe("Updated");
    expect(rehydrated.getDescription()).toBe("New desc");
    expect(rehydrated.getStatus().getValue()).toBe("DOING");
    expect(rehydrated.getVersion()).toBe(3);
    expect(rehydrated.getUncommittedEvents()).toHaveLength(0);
  });

  it("emits TaskAssigneeChanged on assign and unassign", () => {
    const task = Task.create(taskId, "T", "D", "ws", creator);
    task.clearUncommittedEvents();

    const assignee = UserSnapshot.create(
      "user-2",
      "u2@test.com",
      "User Two",
      "U2",
      null,
    );
    task.assignTo("user-2", assignee);
    expect(task.getUncommittedEvents()[0].eventType).toBe(
      TaskDomainEventType.TaskAssigneeChanged,
    );

    task.clearUncommittedEvents();
    task.unassign();
    expect(task.getAssigneeId()).toBeNull();
    expect(task.getUncommittedEvents()[0].eventType).toBe(
      TaskDomainEventType.TaskAssigneeChanged,
    );
  });

  it("marks task deleted via TaskDeleted event", () => {
    const task = Task.create(taskId, "T", "D", "ws", creator);
    task.clearUncommittedEvents();
    task.delete();

    expect(task.isDeleted()).toBe(true);
    expect(task.getUncommittedEvents()[0].eventType).toBe(
      TaskDomainEventType.TaskDeleted,
    );
  });

  it("rejects invalid status transition on changeStatus", () => {
    const task = Task.restore(
      taskId,
      "T",
      "D",
      "DONE",
      "ws",
      null,
      null,
      null,
      creator,
      new Date(),
      new Date(),
    );

    expect(() => task.changeStatus("TODO")).toThrow(BusinessRuleException);
  });
});
