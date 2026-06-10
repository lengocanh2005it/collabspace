import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { ConfigurationService } from "./configuration/configuration.service"; // Import service của bạn
import { MetricsService } from "./metrics/metrics.service";
import { registerMetricsMiddleware } from "./metrics/register-metrics.middleware";
import { bootstrapTracing } from "./observability/tracing";

async function bootstrap() {
  bootstrapTracing("task-service");
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
  registerMetricsMiddleware(app, app.get(MetricsService));

  const config = new DocumentBuilder()
    .setTitle("CollabSpace - Task Service API")
    .setDescription("Complete CRUD API with Clean Architecture + CQRS pattern")
    .setVersion("1.0.0")
    .addTag("tasks", "Task management endpoints")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "JWT",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`✅ Task Service is running on port ${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}
void bootstrap();
