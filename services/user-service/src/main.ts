import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const dataSource = app.get(DataSource);

  if (process.env.DATABASE_URL && !dataSource.isInitialized) {
    await dataSource.initialize();
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

    await app.startAllMicroservices();
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
