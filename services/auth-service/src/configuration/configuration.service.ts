import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transport, type GrpcOptions, type RmqOptions } from '@nestjs/microservices';
import { buildConsumerQueueOptions } from '@collabspace/shared';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { RedisOptions } from 'ioredis';
import { join } from 'node:path';
import type { GraphileWorkerModuleOptions } from '@/infrastructure/graphile-worker/graphile-worker.types';

export type AppConfig = {
  port: number;
};

export type AuthJwtConfig = {
  audience?: string;
  expiry: string;
  issuer?: string;
  secret?: string;
};

export type VerifyLiteCacheConfig = {
  enabled: boolean;
  maxTtlSeconds: number;
};

export type EmailVerificationConfig = {
  otpLength: number;
  otpTtlSeconds: number;
  resendCooldownSeconds: number;
  resendMaxAttempts: number;
  resendWindowSeconds: number;
};

export type PasswordResetConfig = {
  tokenByteLength: number;
  ttlSeconds: number;
};

export type DatabaseConfig = {
  autoLoadEntities: boolean;
  logging: boolean;
  schema: string;
  ssl: boolean;
  synchronize: boolean;
  url?: string;
};

export type EmailConfig = {
  deliveryTimeoutMs: number;
  queueTimeoutMs: number;
  jobMaxAttempts: number;
};

export type BrevoConfig = {
  apiKey?: string;
  senderEmail: string;
  senderName: string;
};

export type GraphileWorkerConfig = {
  concurrency: number;
  connectionString?: string;
  enabled: boolean;
  pollInterval: number;
  schema: string;
};

export type OutboxConfig = {
  batchSize: number;
  degradedFailedThreshold: number;
  degradedPendingThreshold: number;
  enabled: boolean;
  maxAttempts: number;
  pollIntervalMs: number;
  publishTimeoutMs: number;
  staleClaimThresholdMs: number;
};

export type GrpcConfig = {
  enabled: boolean;
  includeDirs: string[];
  packageName: string | string[];
  protoPath: string[];
  url: string;
};

export type RefreshTokenConfig = {
  byteLength: number;
  ttlDays: number;
};

export type RabbitMqConfig = {
  enabled: boolean;
  noAck: boolean;
  publishTimeoutMs: number;
  prefetchCount: number;
  queue: string;
  queueDurable: boolean;
  userServiceQueue: string;
  url?: string;
};

export type RedisConfig = {
  db: number;
  host: string;
  keyPrefix: string;
  password?: string;
  port: number;
  url?: string;
  username?: string;
};

export type UserServiceConfig = {
  grpcUrl: string;
  grpcTimeoutMs: number;
};

@Injectable()
export class ConfigurationService {
  constructor(private readonly configService: ConfigService) {}

  getAppConfig(): AppConfig {
    return {
      port: this.configService.get<number>('app.port') ?? 3000,
    };
  }

  getAuthJwtConfig(): AuthJwtConfig {
    return {
      audience: this.configService.get<string>('auth.jwt.audience') || undefined,
      expiry: this.configService.get<string>('auth.jwt.expiry') ?? '1h',
      issuer: this.configService.get<string>('auth.jwt.issuer') || undefined,
      secret: this.configService.get<string>('auth.jwt.secret') || undefined,
    };
  }

  getVerifyLiteCacheConfig(): VerifyLiteCacheConfig {
    return {
      enabled: this.configService.get<boolean>('auth.verifyLiteCache.enabled') ?? true,
      maxTtlSeconds: this.configService.get<number>('auth.verifyLiteCache.maxTtlSeconds') ?? 300,
    };
  }

  getEmailVerificationConfig(): EmailVerificationConfig {
    return {
      otpLength: this.configService.get<number>('auth.emailVerification.otpLength') ?? 6,
      otpTtlSeconds: this.configService.get<number>('auth.emailVerification.otpTtlSeconds') ?? 600,
      resendCooldownSeconds:
        this.configService.get<number>('auth.emailVerification.resendCooldownSeconds') ?? 60,
      resendMaxAttempts:
        this.configService.get<number>('auth.emailVerification.resendMaxAttempts') ?? 5,
      resendWindowSeconds:
        this.configService.get<number>('auth.emailVerification.resendWindowSeconds') ?? 3600,
    };
  }

  getPasswordResetConfig(): PasswordResetConfig {
    return {
      tokenByteLength: this.configService.get<number>('auth.passwordReset.tokenByteLength') ?? 32,
      ttlSeconds: this.configService.get<number>('auth.passwordReset.ttlSeconds') ?? 1800,
    };
  }

  getDatabaseConfig(): DatabaseConfig {
    return {
      autoLoadEntities: this.configService.get<boolean>('database.autoLoadEntities') ?? true,
      logging: this.configService.get<boolean>('database.logging') ?? false,
      schema: this.configService.get<string>('database.schema') ?? 'public',
      ssl: this.configService.get<boolean>('database.ssl') ?? false,
      synchronize: this.configService.get<boolean>('database.synchronize') ?? false,
      url: this.configService.get<string>('database.url') || undefined,
    };
  }

  getDatabaseModuleOptions(): TypeOrmModuleOptions {
    const databaseConfig = this.getDatabaseConfig();

    return {
      autoLoadEntities: databaseConfig.autoLoadEntities,
      logging: databaseConfig.logging,
      manualInitialization: true,
      retryAttempts: 5,
      retryDelay: 0,
      schema: databaseConfig.schema,
      ssl: databaseConfig.ssl ? { rejectUnauthorized: false } : false,
      synchronize: databaseConfig.synchronize,
      type: 'postgres',
      url: databaseConfig.url,
    };
  }

  getEmailConfig(): EmailConfig {
    return {
      deliveryTimeoutMs: this.configService.get<number>('email.deliveryTimeoutMs') ?? 15000,
      queueTimeoutMs: this.configService.get<number>('email.queueTimeoutMs') ?? 5000,
      jobMaxAttempts: this.configService.get<number>('email.jobMaxAttempts') ?? 5,
    };
  }

  getBrevoConfig(): BrevoConfig {
    return {
      apiKey: this.configService.get<string>('brevo.apiKey') || undefined,
      senderEmail: this.configService.get<string>('brevo.senderEmail') ?? '',
      senderName: this.configService.get<string>('brevo.senderName') ?? 'CollabSpace',
    };
  }

  getGraphileWorkerConfig(): GraphileWorkerConfig {
    return {
      concurrency: this.configService.get<number>('graphileWorker.concurrency') ?? 5,
      connectionString: this.getDatabaseConfig().url,
      enabled: this.configService.get<boolean>('graphileWorker.enabled') ?? false,
      pollInterval: this.configService.get<number>('graphileWorker.pollInterval') ?? 2000,
      schema: this.configService.get<string>('graphileWorker.schema') ?? 'graphile_worker',
    };
  }

  getGraphileWorkerModuleOptions(): GraphileWorkerModuleOptions {
    const graphileWorkerConfig = this.getGraphileWorkerConfig();

    return {
      concurrency: graphileWorkerConfig.concurrency,
      connectionString: graphileWorkerConfig.connectionString,
      disabled: !graphileWorkerConfig.enabled || !graphileWorkerConfig.connectionString,
      pollInterval: graphileWorkerConfig.pollInterval,
      schema: graphileWorkerConfig.schema,
      taskList: {},
    };
  }

  getOutboxConfig(): OutboxConfig {
    return {
      batchSize: this.configService.get<number>('outbox.batchSize') ?? 20,
      degradedFailedThreshold:
        this.configService.get<number>('outbox.degradedFailedThreshold') ?? 1,
      degradedPendingThreshold:
        this.configService.get<number>('outbox.degradedPendingThreshold') ?? 50,
      enabled: this.configService.get<boolean>('outbox.enabled') ?? true,
      maxAttempts: this.configService.get<number>('outbox.maxAttempts') ?? 10,
      pollIntervalMs: this.configService.get<number>('outbox.pollIntervalMs') ?? 5000,
      publishTimeoutMs: this.configService.get<number>('outbox.publishTimeoutMs') ?? 30000,
      staleClaimThresholdMs: Math.max(
        this.configService.get<number>('outbox.staleClaimThresholdMs') ?? 60000,
        5000,
      ),
    };
  }

  isDevOtpEndpointEnabled(): boolean {
    return this.configService.get<boolean>('dev.exposeOtpEndpoint') ?? false;
  }

  getGrpcConfig(): GrpcConfig {
    const protoDir = join(process.cwd(), 'proto');

    return {
      enabled: this.configService.get<boolean>('grpc.enabled') ?? false,
      includeDirs: [protoDir],
      packageName: 'auth',
      protoPath: [join(protoDir, 'auth.proto')],
      url: this.configService.get<string>('grpc.url') ?? '0.0.0.0:50051',
    };
  }

  getGrpcMicroserviceOptions(): GrpcOptions {
    const grpcConfig = this.getGrpcConfig();

    return {
      options: {
        loader: {
          arrays: true,
          enums: String,
          includeDirs: grpcConfig.includeDirs,
          keepCase: false,
          objects: true,
          oneofs: true,
        },
        package: grpcConfig.packageName,
        protoPath: grpcConfig.protoPath,
        url: grpcConfig.url,
      },
      transport: Transport.GRPC,
    };
  }

  getRabbitMqConfig(): RabbitMqConfig {
    return {
      enabled: this.configService.get<boolean>('rabbitmq.enabled') ?? false,
      noAck: this.configService.get<boolean>('rabbitmq.noAck') ?? false,
      publishTimeoutMs: this.configService.get<number>('rabbitmq.publishTimeoutMs') ?? 3000,
      prefetchCount: this.configService.get<number>('rabbitmq.prefetchCount') ?? 10,
      queue: this.configService.get<string>('rabbitmq.queue') ?? 'auth-service',
      queueDurable: this.configService.get<boolean>('rabbitmq.queueDurable') ?? true,
      userServiceQueue:
        this.configService.get<string>('rabbitmq.userServiceQueue') ?? 'user-service',
      url: this.configService.get<string>('rabbitmq.url') || undefined,
    };
  }

  getRabbitMqMicroserviceOptions(): RmqOptions {
    const rabbitMqConfig = this.getRabbitMqConfig();
    const dlxExchange =
      this.configService.get<string>('RABBITMQ_DLX_EXCHANGE') ?? 'collabspace_dlx';
    const dlxRoutingKey =
      this.configService.get<string>('RABBITMQ_DLX_ROUTING_KEY') ?? `${rabbitMqConfig.queue}.dlq`;

    return {
      options: {
        noAck: rabbitMqConfig.noAck,
        prefetchCount: rabbitMqConfig.prefetchCount,
        queue: rabbitMqConfig.queue,
        queueOptions: buildConsumerQueueOptions({
          durable: rabbitMqConfig.queueDurable,
          deadLetterExchange: dlxExchange,
          deadLetterRoutingKey: dlxRoutingKey,
        }),
        urls: rabbitMqConfig.url ? [rabbitMqConfig.url] : [],
      },
      transport: Transport.RMQ,
    };
  }

  getRefreshTokenConfig(): RefreshTokenConfig {
    return {
      byteLength: this.configService.get<number>('refreshToken.byteLength') ?? 48,
      ttlDays: this.configService.get<number>('refreshToken.ttlDays') ?? 30,
    };
  }

  getRedisConfig(): RedisConfig {
    return {
      db: this.configService.get<number>('redis.db') ?? 0,
      host: this.configService.get<string>('redis.host') ?? '127.0.0.1',
      keyPrefix: this.configService.get<string>('redis.keyPrefix') ?? 'auth:',
      password: this.configService.get<string>('redis.password') || undefined,
      port: this.configService.get<number>('redis.port') ?? 6379,
      url: this.configService.get<string>('redis.url') || undefined,
      username: this.configService.get<string>('redis.username') || undefined,
    };
  }

  getRedisOptions(): RedisOptions {
    const redisConfig = this.getRedisConfig();

    return {
      db: redisConfig.db,
      host: redisConfig.host,
      keyPrefix: redisConfig.keyPrefix,
      lazyConnect: true,
      password: redisConfig.password,
      port: redisConfig.port,
      username: redisConfig.username,
    };
  }

  getUserServiceConfig(): UserServiceConfig {
    return {
      grpcUrl: this.configService.get<string>('userService.grpcUrl') ?? 'user-service:50052',
      grpcTimeoutMs: this.configService.get<number>('userService.grpcTimeoutMs') ?? 3000,
    };
  }
}
