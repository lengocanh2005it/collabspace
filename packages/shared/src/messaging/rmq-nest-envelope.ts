import { randomUUID } from 'node:crypto';

export type RmqNestEnvelope = {
  pattern: string;
  data: Record<string, unknown>;
  id: string;
};

export type RmqInboundRequest = {
  pattern: string | null;
  data: unknown;
};

/** NestJS ClientProxy.emit wire format — use for exchange publishers (workspace outbox). */
export function buildRmqNestEnvelope(
  pattern: string,
  data: Record<string, unknown>,
  id: string = randomUUID(),
): Buffer {
  const envelope: RmqNestEnvelope = { pattern, data, id };
  return Buffer.from(JSON.stringify(envelope));
}

/**
 * Accept both Nest emit envelopes and legacy raw JSON published to topic exchange.
 * Legacy messages use the AMQP routing key as the event pattern.
 */
export function deserializeCollabspaceRmqMessage(
  value: string | Buffer | Record<string, unknown>,
  routingKey?: string | null,
): RmqInboundRequest {
  let parsed: unknown;

  if (
    value !== null &&
    typeof value === 'object' &&
    !Buffer.isBuffer(value) &&
    !Array.isArray(value)
  ) {
    parsed = value;
  } else {
    const raw = typeof value === 'string' ? value : value.toString();
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return { pattern: routingKey ?? null, data: raw };
    }
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    if (typeof record.pattern === 'string' && 'data' in record) {
      return { pattern: record.pattern, data: record.data };
    }
  }

  return { pattern: routingKey ?? null, data: parsed };
}
