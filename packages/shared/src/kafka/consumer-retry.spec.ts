import { retryWithBackoff } from './consumer-retry';

describe('retryWithBackoff', () => {
  it('returns on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(retryWithBackoff(fn, { maxRetries: 2, retryDelayMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries then succeeds', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValue('ok');
    await expect(retryWithBackoff(fn, { maxRetries: 2, retryDelayMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent'));
    await expect(retryWithBackoff(fn, { maxRetries: 2, retryDelayMs: 1 })).rejects.toThrow(
      'persistent',
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
