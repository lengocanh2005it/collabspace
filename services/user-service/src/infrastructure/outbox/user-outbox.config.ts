export type UserOutboxPublishMode = 'debezium';

export function getUserOutboxPublishMode(): UserOutboxPublishMode {
  return 'debezium';
}

export function shouldPublishUserEventsToRabbitMq(): boolean {
  return false;
}
