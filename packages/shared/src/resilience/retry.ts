export type RetryOptions<T> = {
  maxAttempts: number;
  delayMs: number;
  shouldRetryResult?: (result: T) => boolean;
  shouldRetryError?: (error: unknown) => boolean;
};

export async function retryAsync<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions<T>,
): Promise<T> {
  if (options.maxAttempts < 1) {
    throw new Error('Retry maxAttempts must be at least 1');
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      const result = await operation(attempt);
      const shouldRetry = options.shouldRetryResult?.(result) === true;
      if (!shouldRetry || attempt === options.maxAttempts) {
        return result;
      }
    } catch (error) {
      lastError = error;
      const shouldRetry = options.shouldRetryError?.(error) ?? true;
      if (!shouldRetry || attempt === options.maxAttempts) {
        throw error;
      }
    }

    await sleep(options.delayMs * attempt);
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
