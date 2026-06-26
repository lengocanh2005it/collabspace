import { CircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('opens after the configured number of failures and fails fast', async () => {
    const breaker = new CircuitBreaker('dependency', {
      failureThreshold: 2,
      resetTimeoutMs: 10_000,
    });

    await expect(breaker.execute(() => Promise.reject(new Error('first')))).rejects.toThrow(
      'first',
    );
    await expect(breaker.execute(() => Promise.reject(new Error('second')))).rejects.toThrow(
      'second',
    );

    await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toThrow(
      CircuitBreakerOpenError,
    );
    expect(breaker.getState()).toBe('OPEN');
  });

  it('moves to half-open after reset timeout and closes on success', async () => {
    const breaker = new CircuitBreaker('dependency', {
      failureThreshold: 1,
      resetTimeoutMs: 1,
    });

    await expect(breaker.execute(() => Promise.reject(new Error('down')))).rejects.toThrow('down');
    await new Promise((resolve) => setTimeout(resolve, 2));

    expect(breaker.getState()).toBe('HALF_OPEN');
    await expect(breaker.execute(() => Promise.resolve('ok'))).resolves.toBe('ok');
    expect(breaker.getState()).toBe('CLOSED');
  });
});
