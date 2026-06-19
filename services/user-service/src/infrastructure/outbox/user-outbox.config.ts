export type UserOutboxPublishMode = 'rabbitmq' | 'debezium';

export function getUserOutboxPublishMode(): UserOutboxPublishMode {
  const raw = process.env.USER_OUTBOX_PUBLISH_MODE?.toLowerCase();
  if (raw === 'debezium') {
    return 'debezium';
  }

  return 'rabbitmq';
}

export function shouldPublishUserEventsToRabbitMq(): boolean {
  return getUserOutboxPublishMode() !== 'debezium';
}
