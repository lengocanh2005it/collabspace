import './observability/instrumentation';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { AppModule } from './app.module';
import { configureHttpApp } from './app.setup';
import { UserHealthService } from './health/user-health.service';
import { MetricsService } from './metrics/metrics.service';
import { registerMetricsMiddleware } from './metrics/register-metrics.middleware';

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureHttpApp(app);
  registerMetricsMiddleware(app, app.get(MetricsService));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('User Service API')
    .setDescription(
      'CollabSpace user directory: profiles, preferences, status, bulk hydrate, internal replica lookup.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Internal-Service-Token',
      },
      'internal-service-token',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('swagger', app, swaggerDocument);

  const dataSource = app.get(DataSource);

  let hasConnectedMicroservice = false;

  const protoDir = join(process.cwd(), 'proto');

  if (process.env.DATABASE_URL && !dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const grpcEnabled = toBoolean(process.env.GRPC_ENABLED, true);

  if (grpcEnabled) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.GRPC,
      options: {
        package: 'user',
        protoPath: [join(protoDir, 'user.proto')],
        url: process.env.GRPC_URL ?? '0.0.0.0:50052',
        loader: {
          arrays: true,
          enums: String,
          includeDirs: [protoDir],
          keepCase: false,
          objects: true,
          oneofs: true,
        },
      },
    });

    hasConnectedMicroservice = true;
  }

  const rabbitMqEnabled = toBoolean(process.env.RABBITMQ_ENABLED, false);

  const rabbitMqUrl = process.env.RABBITMQ_URL;

  if (rabbitMqEnabled && rabbitMqUrl) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rabbitMqUrl],
        queue: process.env.RABBITMQ_QUEUE ?? 'user-service',
        queueOptions: {
          durable: toBoolean(process.env.RABBITMQ_QUEUE_DURABLE, true),
        },
        prefetchCount: Number(process.env.RABBITMQ_PREFETCH_COUNT ?? 10),
        noAck: toBoolean(process.env.RABBITMQ_NO_ACK, false),
      },
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

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port);

  Logger.log(`HTTP Server: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Swagger Docs: http://localhost:${port}/swagger`, 'Bootstrap');
}

bootstrap();
