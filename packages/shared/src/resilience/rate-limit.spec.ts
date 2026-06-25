import { createFixedWindowRateLimitMiddleware } from './rate-limit';

describe('createFixedWindowRateLimitMiddleware', () => {
  function createResponse() {
    return {
      body: undefined as unknown,
      code: 200,
      headers: new Map<string, string | number>(),
      json(body: unknown) {
        this.body = body;
      },
      setHeader(name: string, value: string | number) {
        this.headers.set(name, value);
      },
      status(code: number) {
        this.code = code;
        return this;
      },
    };
  }

  it('returns 429 after the configured limit', () => {
    const middleware = createFixedWindowRateLimitMiddleware({ limit: 1, ttlMs: 60_000 });
    const request = { ip: '127.0.0.1', method: 'POST', path: '/api/v1/tasks' };
    const firstResponse = createResponse();
    const secondResponse = createResponse();
    const next = jest.fn();

    middleware(request, firstResponse, next);
    middleware(request, secondResponse, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(secondResponse.code).toBe(429);
    expect(secondResponse.body).toEqual({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
    });
  });

  it('skips configured paths', () => {
    const middleware = createFixedWindowRateLimitMiddleware({
      limit: 0,
      ttlMs: 60_000,
      skipPaths: [/^\/health$/],
    });
    const response = createResponse();
    const next = jest.fn();

    middleware({ ip: '127.0.0.1', method: 'GET', path: '/health' }, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.code).toBe(200);
  });
});
