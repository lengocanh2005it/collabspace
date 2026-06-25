import "./observability/instrumentation";
import "reflect-metadata";
import { assertRequiredInProduction, createServiceRateLimitMiddleware } from "@collabspace/shared";
import { assertWorkspaceClientModeForProduction } from "./configuration/workspace-client-mode";
import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
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
  app.use(createServiceRateLimitMiddleware());

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
