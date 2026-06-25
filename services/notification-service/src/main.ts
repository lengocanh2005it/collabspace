import "./observability/instrumentation";
import { NestFactory } from "@nestjs/core";
import { assertRequiredInProduction, createServiceRateLimitMiddleware } from "@collabspace/shared";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import compression from "compression";

async function bootstrap() {
  assertRequiredInProduction("SERVICE_JWT_SECRET", process.env.SERVICE_JWT_SECRET);

  const app = await NestFactory.create(AppModule);
  app.use(compression());
  app.use(createServiceRateLimitMiddleware());

  const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim());
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.setGlobalPrefix("api/v1");

  if (process.env.SWAGGER_ENABLED !== "false") {
    const { DocumentBuilder, SwaggerModule } = await import("@nestjs/swagger");
    const config = new DocumentBuilder()
      .setTitle("Notification Service API")
      .setDescription("CollabSpace notification list, mark-read, health.")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    const swaggerPath = process.env.SWAGGER_UI_PATH?.trim() || "swagger";
    SwaggerModule.setup(swaggerPath, app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Notification HTTP API is running on port ${port}`);
}

void bootstrap();
