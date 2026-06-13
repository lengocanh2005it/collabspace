const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export default () => ({
  app: {
    port: toNumber(process.env.PORT, 3000),
  },
  auth: {
    emailVerification: {
      otpLength: toNumber(process.env.EMAIL_VERIFICATION_OTP_LENGTH, 6),
      otpTtlSeconds: toNumber(
        process.env.EMAIL_VERIFICATION_OTP_TTL_SECONDS,
        600,
      ),
      resendCooldownSeconds: toNumber(
        process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
        60,
      ),
      resendMaxAttempts: toNumber(
        process.env.EMAIL_VERIFICATION_RESEND_MAX_ATTEMPTS,
        5,
      ),
      resendWindowSeconds: toNumber(
        process.env.EMAIL_VERIFICATION_RESEND_WINDOW_SECONDS,
        3600,
      ),
    },
    passwordReset: {
      tokenByteLength: toNumber(
        process.env.PASSWORD_RESET_TOKEN_BYTE_LENGTH,
        32,
      ),
      ttlSeconds: toNumber(process.env.PASSWORD_RESET_TTL_SECONDS, 1800),
    },
    jwt: {
      audience: process.env.JWT_AUDIENCE,
      expiry: process.env.JWT_EXPIRY ?? '1h',
      issuer: process.env.JWT_ISSUER,
      secret: process.env.JWT_SECRET,
    },
    verifyLiteCache: {
      enabled: toBoolean(process.env.AUTH_VERIFY_LITE_CACHE_ENABLED, true),
      maxTtlSeconds: toNumber(
        process.env.AUTH_VERIFY_LITE_CACHE_MAX_TTL_SECONDS,
        300,
      ),
    },
  },
  database: {
    autoLoadEntities: toBoolean(process.env.DATABASE_AUTO_LOAD_ENTITIES, true),
    logging: toBoolean(process.env.DATABASE_LOGGING, false),
    schema: process.env.DATABASE_SCHEMA ?? 'public',
    ssl: toBoolean(process.env.DATABASE_SSL, false),
    synchronize: toBoolean(process.env.DATABASE_SYNCHRONIZE, false),
    url: process.env.DATABASE_URL,
  },
  email: {
    deliveryTimeoutMs: toNumber(process.env.MAIL_DELIVERY_TIMEOUT_MS, 5000),
    from: process.env.MAIL_FROM ?? 'no-reply@collabspace.local',
    host: process.env.MAIL_HOST ?? '127.0.0.1',
    ignoreTls: toBoolean(process.env.MAIL_IGNORE_TLS, false),
    password: process.env.MAIL_PASSWORD,
    port: toNumber(process.env.MAIL_PORT, 587),
    secure: toBoolean(process.env.MAIL_SECURE, false),
    url: process.env.MAIL_URL,
    user: process.env.MAIL_USER,
  },
  graphileWorker: {
    concurrency: toNumber(process.env.GRAPHILE_WORKER_CONCURRENCY, 5),
    enabled: toBoolean(process.env.GRAPHILE_WORKER_ENABLED, false),
    pollInterval: toNumber(process.env.GRAPHILE_WORKER_POLL_INTERVAL, 2000),
    schema: process.env.GRAPHILE_WORKER_SCHEMA ?? 'graphile_worker',
  },
  outbox: {
    batchSize: toNumber(process.env.OUTBOX_BATCH_SIZE, 20),
    degradedFailedThreshold: toNumber(
      process.env.OUTBOX_DEGRADED_FAILED_THRESHOLD,
      1,
    ),
    degradedPendingThreshold: toNumber(
      process.env.OUTBOX_DEGRADED_PENDING_THRESHOLD,
      50,
    ),
    enabled: toBoolean(process.env.OUTBOX_ENABLED, true),
    maxAttempts: toNumber(process.env.OUTBOX_MAX_ATTEMPTS, 10),
    pollIntervalMs: toNumber(process.env.OUTBOX_POLL_INTERVAL_MS, 5000),
    staleClaimThresholdMs: toNumber(
      process.env.OUTBOX_STALE_CLAIM_THRESHOLD_MS,
      60000,
    ),
  },
  dev: {
    exposeOtpEndpoint: toBoolean(process.env.ALLOW_DEV_OTP_ENDPOINT, false),
  },
  grpc: {
    enabled: toBoolean(process.env.GRPC_ENABLED, true),
    url: process.env.GRPC_URL ?? '0.0.0.0:50051',
  },
  rabbitmq: {
    enabled: toBoolean(process.env.RABBITMQ_ENABLED, false),
    noAck: toBoolean(process.env.RABBITMQ_NO_ACK, false),
    publishTimeoutMs: toNumber(process.env.RABBITMQ_PUBLISH_TIMEOUT_MS, 3000),
    prefetchCount: toNumber(process.env.RABBITMQ_PREFETCH_COUNT, 10),
    queue: process.env.RABBITMQ_QUEUE ?? 'auth-service',
    queueDurable: toBoolean(process.env.RABBITMQ_QUEUE_DURABLE, true),
    userServiceQueue: process.env.RABBITMQ_USER_SERVICE_QUEUE ?? 'user-service',
    url: process.env.RABBITMQ_URL,
  },
  refreshToken: {
    byteLength: toNumber(process.env.REFRESH_TOKEN_BYTE_LENGTH, 48),
    ttlDays: toNumber(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
  },
  redis: {
    db: toNumber(process.env.REDIS_DB, 0),
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'auth:',
    password: process.env.REDIS_PASSWORD,
    port: toNumber(process.env.REDIS_PORT, 6379),
    url: process.env.REDIS_URL,
    username: process.env.REDIS_USERNAME,
  },
  userService: {
    grpcUrl: process.env.USER_SERVICE_GRPC_URL ?? 'user-service:50052',
    grpcTimeoutMs: toNumber(process.env.USER_SERVICE_GRPC_TIMEOUT_MS, 3000),
  },
});
