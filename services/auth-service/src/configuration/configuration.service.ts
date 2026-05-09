import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Transport,
  type GrpcOptions,
  type RmqOptions,
} from '@nestjs/microservices';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { RedisOptions } from 'ioredis';
import { join } from 'node:path';
import type { GraphileWorkerModuleOptions } from '@/modules/graphile-worker/graphile-worker.types';

export type AppConfig = {
  port: number;
};

export type AuthJwtConfig = {
  audience?: string;
  expiry: string;
  issuer?: string;
  secret?: string;
};

export type EmailVerificationConfig = {
  otpLength: number;
  otpTtlSeconds: number;
  resendCooldownSeconds: number;
  resendMaxAttempts: number;
  resendWindowSeconds: number;
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
  from: string;
  host: string;
  ignoreTls: boolean;
  password?: string;
  port: number;
  secure: boolean;
  url?: string;
  user?: string;
};

export type GraphileWorkerConfig = {
  concurrency: number;
  connectionString?: string;
  enabled: boolean;
  pollInterval: number;
  schema: string;
};

export type GrpcConfig = {
  enabled: boolean;
  packageName: string;
  protoPath: string;
  url: string;
};

export type RefreshTokenConfig = {
  byteLength: number;
  ttlDays: number;
};

export type RabbitMqConfig = {
  enabled: boolean;
  noAck: boolean;
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
  url: string;
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
      audience:
        this.configService.get<string>('auth.jwt.audience') || undefined,
      expiry: this.configService.get<string>('auth.jwt.expiry') ?? '1h',
      issuer: this.configService.get<string>('auth.jwt.issuer') || undefined,
      secret: this.configService.get<string>('auth.jwt.secret') || undefined,
    };
  }

  getEmailVerificationConfig(): EmailVerificationConfig {
    return {
      otpLength:
        this.configService.get<number>('auth.emailVerification.otpLength') ?? 6,
      otpTtlSeconds:
        this.configService.get<number>(
          'auth.emailVerification.otpTtlSeconds',
        ) ?? 600,
      resendCooldownSeconds:
        this.configService.get<number>(
          'auth.emailVerification.resendCooldownSeconds',
        ) ?? 60,
      resendMaxAttempts:
        this.configService.get<number>(
          'auth.emailVerification.resendMaxAttempts',
        ) ?? 5,
      resendWindowSeconds:
        this.configService.get<number>(
          'auth.emailVerification.resendWindowSeconds',
        ) ?? 3600,
    };
  }

  getDatabaseConfig(): DatabaseConfig {
    return {
      autoLoadEntities:
        this.configService.get<boolean>('database.autoLoadEntities') ?? true,
      logging: this.configService.get<boolean>('database.logging') ?? false,
      schema: this.configService.get<string>('database.schema') ?? 'public',
      ssl: this.configService.get<boolean>('database.ssl') ?? false,
      synchronize:
        this.configService.get<boolean>('database.synchronize') ?? false,
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
      from:
        this.configService.get<string>('email.from') ??
        'no-reply@collabspace.local',
      host: this.configService.get<string>('email.host') ?? '127.0.0.1',
      ignoreTls: this.configService.get<boolean>('email.ignoreTls') ?? false,
      password: this.configService.get<string>('email.password') || undefined,
      port: this.configService.get<number>('email.port') ?? 587,
      secure: this.configService.get<boolean>('email.secure') ?? false,
      url: this.configService.get<string>('email.url') || undefined,
      user: this.configService.get<string>('email.user') || undefined,
    };
  }

  getGraphileWorkerConfig(): GraphileWorkerConfig {
    return {
      concurrency:
        this.configService.get<number>('graphileWorker.concurrency') ?? 5,
      connectionString: this.getDatabaseConfig().url,
      enabled:
        this.configService.get<boolean>('graphileWorker.enabled') ?? false,
      pollInterval:
        this.configService.get<number>('graphileWorker.pollInterval') ?? 2000,
      schema:
        this.configService.get<string>('graphileWorker.schema') ??
        'graphile_worker',
    };
  }

  getGraphileWorkerModuleOptions(): GraphileWorkerModuleOptions {
    const graphileWorkerConfig = this.getGraphileWorkerConfig();

    return {
      concurrency: graphileWorkerConfig.concurrency,
      connectionString: graphileWorkerConfig.connectionString,
      disabled:
        !graphileWorkerConfig.enabled || !graphileWorkerConfig.connectionString,
      pollInterval: graphileWorkerConfig.pollInterval,
      schema: graphileWorkerConfig.schema,
      taskList: {},
    };
  }

  getGrpcConfig(): GrpcConfig {
    return {
      enabled: this.configService.get<boolean>('grpc.enabled') ?? false,
      packageName: 'auth',
      protoPath: join(process.cwd(), 'proto', 'auth.proto'),
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
      prefetchCount:
        this.configService.get<number>('rabbitmq.prefetchCount') ?? 10,
      queue:
        this.configService.get<string>('rabbitmq.queue') ?? 'auth-service',
      queueDurable:
        this.configService.get<boolean>('rabbitmq.queueDurable') ?? true,
      userServiceQueue:
        this.configService.get<string>('rabbitmq.userServiceQueue') ??
        'user-service',
      url: this.configService.get<string>('rabbitmq.url') || undefined,
    };
  }

  getRabbitMqMicroserviceOptions(): RmqOptions {
    const rabbitMqConfig = this.getRabbitMqConfig();

    return {
      options: {
        noAck: rabbitMqConfig.noAck,
        prefetchCount: rabbitMqConfig.prefetchCount,
        queue: rabbitMqConfig.queue,
        queueOptions: {
          durable: rabbitMqConfig.queueDurable,
        },
        urls: rabbitMqConfig.url ? [rabbitMqConfig.url] : [],
      },
      transport: Transport.RMQ,
    };
  }

  getRefreshTokenConfig(): RefreshTokenConfig {
    return {
      byteLength:
        this.configService.get<number>('refreshToken.byteLength') ?? 48,
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
      url:
        this.configService.get<string>('userService.url') ??
        'http://user-service:3000',
    };
  }
}
