/**
 * Normalize TypeORM `DataSource.query()` / `manager.query()` results to row arrays.
 * Postgres drivers may return plain row arrays, `{ rows }` objects, or `[rows, rowCount]` tuples.
 */
export function unwrapQueryRows<T extends Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) {
    if (result.length === 2) {
      const [first, second] = result;

      if (Array.isArray(first) && (typeof second === 'number' || typeof second === 'bigint')) {
        return first as T[];
      }

      if (Array.isArray(second) && (typeof first === 'number' || typeof first === 'bigint')) {
        return second as T[];
      }
    }

    return result as T[];
  }

  if (
    typeof result === 'object' &&
    result !== null &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }

  return [];
}
