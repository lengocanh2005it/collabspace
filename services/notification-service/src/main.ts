import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { ConfigurationService } from "./configuration/configuration.service";
import { ValidationPipe } from "@nestjs/common";
import compression from "compression";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(compression());

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
      `Notification Service is listening to RabbitMQ: ${rmqConfig.queue}`,
    );
  }
  const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim());
  app.enableCors({ origin: corsOrigins, credentials: true });

  // 2. Cấu hình HTTP API
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

bootstrap();
