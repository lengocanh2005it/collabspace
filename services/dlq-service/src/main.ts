import './observability/instrumentation';
import { NestFactory } from '@nestjs/core';
import { assertRequiredInProduction } from '@collabspace/shared';
import { ValidationPipe } from '@nestjs/common';
import compression from 'compression';
import { AppModule } from './app.module';
import { MetricsService } from './metrics/metrics.service';
import { registerMetricsMiddleware } from './metrics/register-metrics.middleware';
import { requestIdMiddleware } from './common/http/request-id.middleware';

async function bootstrap() {
  assertRequiredInProduction('SERVICE_JWT_SECRET', process.env.SERVICE_JWT_SECRET);

  const app = await NestFactory.create(AppModule);
  app.use(compression());
  app.use(requestIdMiddleware);

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim());
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.setGlobalPrefix('api/v1');

  const metricsService = app.get(MetricsService);
  registerMetricsMiddleware(app, metricsService);

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle('DLQ Service API')
      .setDescription('CollabSpace Dead Letter Queue — ingest, inspect, replay, discard, audit.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    const swaggerPath = process.env.SWAGGER_UI_PATH?.trim() || 'swagger';
    SwaggerModule.setup(swaggerPath, app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`DLQ Service HTTP API is running on port ${port}`);
}

void bootstrap();
