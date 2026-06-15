import "./observability/instrumentation";
import "reflect-metadata";
import { assertRequiredInProduction } from "@collabspace/shared";
import { assertWorkspaceClientModeForProduction } from "./configuration/workspace-client-mode";
import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { type MicroserviceOptions, Transport } from "@nestjs/microservices";
import { buildConsumerQueueOptions } from "@collabspace/shared";
import { ConfigurationService } from "./configuration/configuration.service";
import { MetricsService } from "./metrics/metrics.service";
import { registerRequestIdMiddleware } from "./common/http/register-request-id.middleware";
import { registerMetricsMiddleware } from "./metrics/register-metrics.middleware";
import compression from "compression";
async function bootstrap() {
  const logger = new Logger("Bootstrap");
  assertRequiredInProduction("SERVICE_JWT_SECRET", process.env.SERVICE_JWT_SECRET);
  assertWorkspaceClientModeForProduction();

  const app = await NestFactory.create(AppModule);
  app.use(compression());

  // --- PHẦN MỚI: CẤU HÌNH MICROSERVICE ---
  const configService = app.get(ConfigurationService);
  const rmqConfig = configService.getRabbitMqConfig();

  if (rmqConfig.enabled) {
    const dlxExchange = process.env.RABBITMQ_DLX_EXCHANGE ?? "collabspace_dlx";
    const dlxRoutingKey = process.env.RABBITMQ_DLX_ROUTING_KEY ?? `${rmqConfig.queue}.dlq`;

    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rmqConfig.url],
        queue: rmqConfig.queue,
        queueOptions: buildConsumerQueueOptions({
          durable: rmqConfig.queueDurable,
          deadLetterExchange: dlxExchange,
          deadLetterRoutingKey: dlxRoutingKey,
        }),
        noAck: rmqConfig.noAck,
        prefetchCount: rmqConfig.prefetchCount,
      },
    });
    // Bắt đầu lắng nghe các event từ RabbitMQ
    await app.startAllMicroservices();
    logger.log("RabbitMQ microservice is connected and listening");
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

  const corsOrigins = (
    process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:3000,http://localhost"
  )
    .split(",")
    .map((s) => s.trim());
  app.enableCors({
    origin: corsOrigins,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Request-Id"],
    credentials: true,
  });

  app.setGlobalPrefix("api/v1");
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
  const swaggerPath = process.env.SWAGGER_UI_PATH?.trim() || "swagger";
  if (process.env.SWAGGER_ENABLED !== "false") {
    SwaggerModule.setup(swaggerPath, app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Task Service is running on port ${port}`);
  logger.log(`Swagger Docs: http://localhost:${port}/${swaggerPath}`);
}
void bootstrap();
