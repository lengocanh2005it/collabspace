export type TaskOutboxPublishMode = "rabbitmq" | "debezium";

export function getTaskOutboxPublishMode(): TaskOutboxPublishMode {
  const raw = process.env.TASK_OUTBOX_PUBLISH_MODE?.toLowerCase();
  if (raw === "debezium") {
    return "debezium";
  }

  return "rabbitmq";
}

export function shouldPublishTaskOutboxToRabbitMq(): boolean {
  return getTaskOutboxPublishMode() !== "debezium";
}
