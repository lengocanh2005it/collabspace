import { retryAsync } from './retry';

describe('retryAsync', () => {
  it('retries retryable results and returns the first successful result', async () => {
    const statuses = [503, 200];
    const operation = jest.fn(async () => {
      const status = statuses.shift();
      if (status === undefined) {
        throw new Error('unexpected attempt');
      }
      return status;
    });

    await expect(
      retryAsync(operation, {
        maxAttempts: 3,
        delayMs: 0,
        shouldRetryResult: (status) => status >= 500,
      }),
    ).resolves.toBe(200);

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable results', async () => {
    const operation = jest.fn(async () => 404);

    await expect(
      retryAsync(operation, {
        maxAttempts: 3,
        delayMs: 0,
        shouldRetryResult: (status) => status >= 500,
      }),
    ).resolves.toBe(404);

    expect(operation).toHaveBeenCalledTimes(1);
  });
});
