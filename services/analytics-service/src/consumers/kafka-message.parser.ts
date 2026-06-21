/**
 * Parse Kafka message value to a plain object.
 * Handles Debezium outbox double-encoded JSON and plain JSON.
 */
export function parseKafkaJsonValue(
  value: Buffer | string | null | undefined,
): Record<string, unknown> | null {
  if (value == null) return null;

  const raw = typeof value === 'string' ? value : value.toString('utf8');
  if (raw.trim().length === 0) return null;

  try {
    let parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string') {
      const inner = parsed.trim();
      if (inner.startsWith('{') || inner.startsWith('[')) {
        parsed = JSON.parse(inner);
      }
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
