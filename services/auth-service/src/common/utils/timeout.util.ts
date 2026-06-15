export class OperationTimeoutError extends Error {
  constructor(
    public readonly operation: string,
    public readonly timeoutMs: number,
  ) {
    super(`${operation} timed out after ${timeoutMs}ms`);
    this.name = 'OperationTimeoutError';
  }
}

export const isOperationTimeoutError = (error: unknown): error is OperationTimeoutError =>
  error instanceof OperationTimeoutError;

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new OperationTimeoutError(operationName, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
