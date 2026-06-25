import Opossum from 'opossum';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type CircuitBreakerOptions = {
  failureThreshold: number;
  resetTimeoutMs: number;
};

export class CircuitBreakerOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private readonly breaker: Opossum<[() => Promise<unknown>], unknown>;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions,
  ) {
    if (options.failureThreshold < 1) {
      throw new Error('Circuit breaker failureThreshold must be at least 1');
    }

    if (options.resetTimeoutMs < 1) {
      throw new Error('Circuit breaker resetTimeoutMs must be at least 1');
    }

    this.breaker = new Opossum<[() => Promise<unknown>], unknown>(
      (operation: () => Promise<unknown>) => operation(),
      {
        errorThresholdPercentage: 1,
        name,
        resetTimeout: options.resetTimeoutMs,
        rollingCountTimeout: Math.max(options.resetTimeoutMs, 10_000),
        timeout: false,
        volumeThreshold: options.failureThreshold,
      },
    );
  }

  getState(): CircuitBreakerState {
    if (this.breaker.halfOpen) {
      return 'HALF_OPEN';
    }

    if (this.breaker.opened) {
      return 'OPEN';
    }

    return 'CLOSED';
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.getState() === 'OPEN') {
      throw new CircuitBreakerOpenError(`${this.name} circuit breaker is open`);
    }

    try {
      return (await this.breaker.fire(operation)) as T;
    } catch (error) {
      if (isOpenBreakerError(error)) {
        throw new CircuitBreakerOpenError(`${this.name} circuit breaker is open`);
      }
      throw error;
    }
  }
}

function isOpenBreakerError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as Error & { code?: string }).code;
  return code === 'EOPENBREAKER' || error.message === 'Breaker is open';
}
