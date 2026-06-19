import { parseKafkaOutboxJsonValue, toWorkspaceDeletedEventPayload } from "./kafka-outbox-message";

describe("kafka-outbox-message", () => {
  it("parses workspace deleted Debezium outbox JSON value", () => {
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
  });

  it("returns null for invalid payload", () => {
    expect(toWorkspaceDeletedEventPayload({ workspaceId: "ws" })).toBeNull();
    expect(parseKafkaOutboxJsonValue(Buffer.from("not-json"))).toBeNull();
  });
});
