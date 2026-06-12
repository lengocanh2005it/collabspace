import "./observability/instrumentation";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { ConfigurationService } from "./configuration/configuration.service";
import { Logger, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { MetricsService } from "./metrics/metrics.service";
import { registerRequestIdMiddleware } from "./common/http/register-request-id.middleware";
import { registerMetricsMiddleware } from "./metrics/register-metrics.middleware";
async function bootstrap() {
  const logger = new Logger("Bootstrap");
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
    logger.log(
      `Notification Service is listening to RabbitMQ: ${rmqConfig.queue}`,
    );
  }
  app.enableCors({
    origin: "*",
    credentials: true,
  });
  // 2. Cấu hình HTTP API
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.setGlobalPrefix("api/v1");
  registerRequestIdMiddleware(app);
  registerMetricsMiddleware(app, app.get(MetricsService));

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Notification Service API")
    .setDescription(
      "CollabSpace notifications: list, mark-read, mark-all-read. JWT via auth gRPC. Events consumed via RabbitMQ (not in this doc).",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("swagger", app, swaggerDocument);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Notification HTTP API is running on port ${port}`);
  logger.log(`Swagger Docs: http://localhost:${port}/swagger`);
}

void bootstrap();
