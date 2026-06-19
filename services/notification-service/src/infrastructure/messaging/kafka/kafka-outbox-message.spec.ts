import {
  parseKafkaOutboxJsonValue,
  toWorkspaceInvitedEventPayload,
  toWorkspaceDeletedEventPayload,
} from "./kafka-outbox-message";

describe("kafka-outbox-message", () => {
  it("parses expanded Debezium outbox JSON value", () => {
    const payload = {
      eventId: "evt-1",
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
});
