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
  private failureCount = 0;
  private openedAt = 0;
  private halfOpenProbeInFlight = false;
  private state: CircuitBreakerState = 'CLOSED';

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions,
  ) {
    if (options.failureThreshold < 1) {
      throw new Error('Circuit breaker failureThreshold must be at least 1');
    }

    if (options.resetTimeoutMs < 1) {
      throw new Error('Circuit breaker resetTimeoutMs must be at least 1');
    }
  }

  getState(): CircuitBreakerState {
    if (this.state === 'OPEN' && this.canProbe()) {
      return 'HALF_OPEN';
    }

    return this.state;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new CircuitBreakerOpenError(`${this.name} circuit breaker is open`);
    }

    if (currentState === 'HALF_OPEN') {
      if (this.halfOpenProbeInFlight) {
        throw new CircuitBreakerOpenError(`${this.name} circuit breaker probe already in flight`);
      }

      this.state = 'HALF_OPEN';
      this.halfOpenProbeInFlight = true;
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    } finally {
      this.halfOpenProbeInFlight = false;
    }
  }

  private canProbe(): boolean {
    return Date.now() - this.openedAt >= this.options.resetTimeoutMs;
  }

  private recordSuccess(): void {
    this.failureCount = 0;
    this.openedAt = 0;
    this.state = 'CLOSED';
  }

  private recordFailure(): void {
    if (this.state === 'HALF_OPEN') {
      this.open();
      return;
    }

    this.failureCount += 1;
    if (this.failureCount >= this.options.failureThreshold) {
      this.open();
    }
  }

  private open(): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
  }
}
