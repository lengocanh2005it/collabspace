import "./observability/instrumentation";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { ConfigurationService } from "./configuration/configuration.service"; // Import service của bạn
import { MetricsService } from "./metrics/metrics.service";
import { registerRequestIdMiddleware } from "./common/http/register-request-id.middleware";
import { registerMetricsMiddleware } from "./metrics/register-metrics.middleware";
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- PHẦN MỚI: CẤU HÌNH MICROSERVICE ---
  const configService = app.get(ConfigurationService);
  const rmqConfig = configService.getRabbitMqConfig();

  if (rmqConfig.enabled) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rmqConfig.url],
        queue: rmqConfig.queue, // 'user-service' hoặc 'task-service' tùy config
        queueOptions: {
          durable: rmqConfig.queueDurable,
        },
        noAck: rmqConfig.noAck,
        prefetchCount: rmqConfig.prefetchCount,
      },
    });
    // Bắt đầu lắng nghe các event từ RabbitMQ
    await app.startAllMicroservices();
    console.log(`📡 RabbitMQ Microservice is connected and listening`);
  }
  // ----------------------------

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: "*",
    credentials: true,
  });

  app.setGlobalPrefix("api");
  registerRequestIdMiddleware(app);
  registerMetricsMiddleware(app, app.get(MetricsService));

  const config = new DocumentBuilder()
    .setTitle("Task Service API")
    .setDescription(
      "CollabSpace tasks, board, comments, attachments, activity feed. JWT via auth gRPC. Idempotency-Key on create task and assign.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("swagger", app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Task Service is running on port ${port}`);
  console.log(`Swagger Docs: http://localhost:${port}/swagger`);
}
void bootstrap();
