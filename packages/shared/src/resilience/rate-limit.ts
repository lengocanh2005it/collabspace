type HeaderValue = string | string[] | undefined;

type MinimalRequest = {
  headers?: Record<string, HeaderValue>;
  ip?: string;
  method?: string;
  path?: string;
  socket?: {
    remoteAddress?: string;
  };
};

type MinimalResponse = {
  setHeader(name: string, value: string | number): void;
  status(code: number): MinimalResponse;
  json(body: unknown): void;
};

export type RateLimitMiddlewareOptions = {
  enabled?: boolean;
  limit: number;
  skipPaths?: RegExp[];
  ttlMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export function createFixedWindowRateLimitMiddleware(options: RateLimitMiddlewareOptions) {
  const buckets = new Map<string, Bucket>();

  return (request: MinimalRequest, response: MinimalResponse, next: () => void): void => {
    if (options.enabled === false || shouldSkip(request, options.skipPaths ?? [])) {
      next();
      return;
    }

    const now = Date.now();
    const key = clientKey(request);
    const current = buckets.get(key);
    const bucket =
      current && current.resetAt > now ? current : { count: 0, resetAt: now + options.ttlMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(options.limit - bucket.count, 0);
    response.setHeader('X-RateLimit-Limit', options.limit);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > options.limit) {
      response.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      response.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
      });
      return;
    }

    if (bucket.count === 1 && buckets.size > options.limit * 20) {
      pruneExpiredBuckets(buckets, now);
    }

    next();
  };
}

export function createServiceRateLimitMiddleware(
  env: Record<string, string | undefined> = process.env,
) {
  return createFixedWindowRateLimitMiddleware({
    enabled: env.SERVICE_RATE_LIMIT_ENABLED !== 'false',
    limit: positiveInteger(env.SERVICE_RATE_LIMIT_PER_MINUTE, 100),
    ttlMs: positiveInteger(env.SERVICE_RATE_LIMIT_TTL_MS, 60_000),
    skipPaths: [
      /^\/swagger(?:\/|$)/,
      /^\/api\/v1\/swagger(?:\/|$)/,
      /^\/api\/v1\/[^/]+\/health(?:\/|$)/,
      /^\/api\/v1\/[^/]+\/metrics(?:\/|$)/,
      /^\/api\/v1\/metrics(?:\/|$)/,
      /^\/metrics(?:\/|$)/,
    ],
  });
}

function shouldSkip(request: MinimalRequest, skipPaths: RegExp[]): boolean {
  const path = request.path ?? '';
  return skipPaths.some((pattern) => pattern.test(path));
}

function clientKey(request: MinimalRequest): string {
  const forwardedFor = request.headers?.['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const ip = forwardedIp?.split(',')[0]?.trim() || request.ip || request.socket?.remoteAddress;
  return `${ip ?? 'unknown'}:${request.method ?? 'UNKNOWN'}`;
}

function pruneExpiredBuckets(buckets: Map<string, Bucket>, now: number): void {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
