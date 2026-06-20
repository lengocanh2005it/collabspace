import {
  parseKafkaOutboxJsonValue,
  toWorkspaceInvitedEventPayload,
  toWorkspaceDeletedEventPayload,
  toUserProfileUpdatedEventPayload,
  toUserRegisteredEventPayload,
} from "./kafka-outbox-message";

describe("kafka-outbox-message", () => {
  it("parses expanded Debezium outbox JSON value", () => {
    const payload = {
      eventId: "evt-1",
      occurredAt: "2026-06-20T00:00:00.000Z",
      workspaceId: "ws-1",
      invitedById: "user-1",
      recipientId: "user-2",
    };

    const record = parseKafkaOutboxJsonValue(Buffer.from(JSON.stringify(payload)));
    expect(record).not.toBeNull();
    if (!record) {
      throw new Error("expected parsed record");
    }

    expect(record).toEqual(payload);
    expect(toWorkspaceInvitedEventPayload(record)).toEqual(payload);
  });

  it("returns null for invalid workspace invite payload", () => {
    expect(toWorkspaceInvitedEventPayload({ invitedById: "x" })).toBeNull();
    expect(parseKafkaOutboxJsonValue(Buffer.from("not-json"))).toBeNull();
  });

  it("parses workspace deleted payload", () => {
    const payload = {
      eventId: "evt-del",
      occurredAt: "2026-06-20T00:00:00.000Z",
      workspaceId: "ws-del",
      deletedById: "user-del",
    };

    const record = parseKafkaOutboxJsonValue(Buffer.from(JSON.stringify(payload)));
    expect(record).not.toBeNull();
    if (!record) {
      throw new Error("expected parsed record");
    }

    expect(toWorkspaceDeletedEventPayload(record)).toEqual(payload);
    expect(toWorkspaceDeletedEventPayload({ workspaceId: "ws" })).toBeNull();
  });

  it("parses user profile updated payload", () => {
    const payload = {
      userId: "user-1",
      fullName: "Jane Doe",
      username: "jane.doe",
      isActive: true,
      occurredAt: "2026-06-19T00:00:00.000Z",
    };

    const record = parseKafkaOutboxJsonValue(Buffer.from(JSON.stringify(payload)));
    expect(record).not.toBeNull();
    if (!record) {
      throw new Error("expected parsed record");
    }

    expect(toUserProfileUpdatedEventPayload(record)).toEqual(payload);
    expect(toUserProfileUpdatedEventPayload({ fullName: "x" })).toBeNull();
  });

  it("parses user registered payload", () => {
    const payload = {
      userId: "user-1",
      fullName: "Jane Doe",
      email: "jane@collabspace.dev",
      occurredAt: "2026-06-19T00:00:00.000Z",
    };

    const record = parseKafkaOutboxJsonValue(Buffer.from(JSON.stringify(payload)));
    expect(record).not.toBeNull();
    if (!record) {
      throw new Error("expected parsed record");
    }

    expect(toUserRegisteredEventPayload(record)).toEqual(payload);
    expect(toUserRegisteredEventPayload({ fullName: "x" })).toBeNull();
  });

  it("parses Mongo Debezium double-encoded JSON string value", () => {
    const payload = {
      eventId: "evt-task",
      taskId: "task-1",
      recipientId: "user-1",
      actorId: "user-2",
      taskTitle: "Demo",
      assignedAt: "2026-06-20T00:00:00.000Z",
      workspaceId: "ws-1",
    };

    const wire = JSON.stringify(JSON.stringify(payload));
    const record = parseKafkaOutboxJsonValue(Buffer.from(wire));
    expect(record).toEqual(payload);
  });
});
