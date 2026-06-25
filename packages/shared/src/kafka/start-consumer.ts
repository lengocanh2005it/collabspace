import { retryWithBackoff } from './consumer-retry';

export type KafkaConsumerStartupLogger = {
  log(message: string): void;
  warn(message: string): void;
  error(message: string, stack?: string): void;
};

export type StartKafkaConsumerWithRetryOptions = {
  description: string;
  connect: () => Promise<void>;
  subscribe: () => Promise<void>;
  run: () => Promise<void>;
  disconnect: () => Promise<void>;
  onStarted: (runPromise: Promise<void>) => void;
  log: KafkaConsumerStartupLogger;
  maxRetries?: number;
  retryDelayMs?: number;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

async function disconnectQuietly(
  disconnect: () => Promise<void>,
  log: KafkaConsumerStartupLogger,
): Promise<void> {
  try {
    await disconnect();
  } catch (error) {
    log.warn(`Kafka consumer disconnect after failed start also failed: ${errorMessage(error)}`);
  }
}

export async function startKafkaConsumerWithRetry(
  options: StartKafkaConsumerWithRetryOptions,
): Promise<void> {
  const maxRetries = options.maxRetries ?? 12;
  const retryDelayMs = options.retryDelayMs ?? 1000;

  try {
    await retryWithBackoff(
      async () => {
        await options.connect();
        try {
          await options.subscribe();
          const runPromise = options.run().catch((error) => {
            options.log.error(
              `${options.description} stopped unexpectedly: ${errorMessage(error)}`,
              errorStack(error),
            );
          });
          options.onStarted(runPromise);
        } catch (error) {
          await disconnectQuietly(options.disconnect, options.log);
          throw error;
        }
      },
      {
        maxRetries,
        retryDelayMs,
        onRetry: (attempt, error) => {
          options.log.warn(
            `${options.description} start retry ${attempt}/${maxRetries}: ${errorMessage(error)}`,
          );
        },
      },
    );
    options.log.log(`${options.description} started`);
  } catch (error) {
    options.log.error(
      `${options.description} failed to start after ${maxRetries + 1} attempts; service will keep running without this Kafka consumer until restart: ${errorMessage(error)}`,
      errorStack(error),
    );
  }
}
