import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { ConfigurationService } from "./configuration/configuration.service";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigurationService);
  const rmqConfig = configService.getRabbitMqConfig();

  // 1. Cấu hình RabbitMQ Consumer
  if (rmqConfig.enabled) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rmqConfig.url],
        queue: rmqConfig.queue,
        queueOptions: { durable: rmqConfig.queueDurable },
        noAck: rmqConfig.noAck,
        prefetchCount: rmqConfig.prefetchCount,
      },
    });
    await app.startAllMicroservices();
    console.log(
      `📡 Notification Service is listening to RabbitMQ: ${rmqConfig.queue}`,
    );
  }
  app.enableCors({
    origin: "*",
    credentials: true,
  });
  // 2. Cấu hình HTTP API
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.setGlobalPrefix("api");

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`✅ Notification HTTP API is running on port ${port}`);
}

void bootstrap();
