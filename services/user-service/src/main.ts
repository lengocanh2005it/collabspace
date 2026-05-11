import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { configureHttpApp } from './app.setup';
import { UserHealthService } from './health/user-health.service';

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureHttpApp(app);
  const dataSource = app.get(DataSource);
  let hasConnectedMicroservice = false;
  const protoDir = join(process.cwd(), 'proto');

  if (process.env.DATABASE_URL && !dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const grpcEnabled = toBoolean(process.env.GRPC_ENABLED, true);

  if (grpcEnabled) {
    app.connectMicroservice<MicroserviceOptions>({
      options: {
        loader: {
          arrays: true,
          enums: String,
          includeDirs: [protoDir],
          keepCase: false,
          objects: true,
          oneofs: true,
        },
        package: 'user',
        protoPath: [join(protoDir, 'user.proto')],
        url: process.env.GRPC_URL ?? '0.0.0.0:50052',
      },
      transport: Transport.GRPC,
    });

    hasConnectedMicroservice = true;
  }

  const rabbitMqEnabled = toBoolean(process.env.RABBITMQ_ENABLED, false);
  const rabbitMqUrl = process.env.RABBITMQ_URL;

  if (rabbitMqEnabled && rabbitMqUrl) {
    app.connectMicroservice<MicroserviceOptions>({
      options: {
        noAck: toBoolean(process.env.RABBITMQ_NO_ACK, false),
        prefetchCount: Number(process.env.RABBITMQ_PREFETCH_COUNT ?? 10),
        queue: process.env.RABBITMQ_QUEUE ?? 'user-service',
        queueOptions: {
          durable: toBoolean(process.env.RABBITMQ_QUEUE_DURABLE, true),
        },
        urls: [rabbitMqUrl],
      },
      transport: Transport.RMQ,
    });

    hasConnectedMicroservice = true;
  }

  if (hasConnectedMicroservice) {
    await app.startAllMicroservices();
  }

  const readiness = await app.get(UserHealthService).getReadiness();
  Logger.log(
    `Startup mode=${readiness.mode} ready=${readiness.ready} checks=${Object.entries(
      readiness.checks,
    )
      .map(([name, check]) => `${name}:${check.status}`)
      .join(', ')}`,
    'Bootstrap',
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
