export type KafkaConsumerRetryOptions = {
  maxRetries: number;
  retryDelayMs: number;
  onRetry?: (attempt: number, error: unknown) => void;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs `fn` up to `maxRetries + 1` times with linear backoff between attempts. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: KafkaConsumerRetryOptions,
): Promise<T> {
  const attempts = Math.max(1, options.maxRetries + 1);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }
      options.onRetry?.(attempt, error);
      await sleep(options.retryDelayMs * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(errorMessage(lastError));
}
