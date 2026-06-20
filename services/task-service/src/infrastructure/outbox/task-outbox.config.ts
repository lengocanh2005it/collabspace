export type TaskOutboxPublishMode = "debezium";

export function getTaskOutboxPublishMode(): TaskOutboxPublishMode {
  return "debezium";
}

export function shouldPublishTaskOutboxToRabbitMq(): boolean {
  return false;
}
