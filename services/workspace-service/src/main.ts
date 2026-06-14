import './observability/instrumentation';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './presentation/http/filters/global-exception.filter';
import { DatabaseService } from './infrastructure/database/database.service';
import { MetricsService } from './metrics/metrics.service';
import { registerRequestIdMiddleware } from './common/http/register-request-id.middleware';
import { registerMetricsMiddleware } from './metrics/register-metrics.middleware';
import compression from 'compression';
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.use(compression());

  await app.get(DatabaseService).initialize();

  app.setGlobalPrefix('api/v1');
  registerRequestIdMiddleware(app);
  registerMetricsMiddleware(app, app.get(MetricsService));

  const dataSource = app.get(require('typeorm').DataSource);
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Workspace Service API')
    .setDescription(
      'CollabSpace workspaces, projects, invitations, membership. JWT via auth gRPC. Idempotency-Key on create workspace and invite.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'service-jwt',
        description:
          'Short-lived service JWT (iss/aud/scope) for internal S2S HTTP.',
      },
      'service-jwt',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  const swaggerPath = process.env.SWAGGER_UI_PATH?.trim() || 'swagger';
  SwaggerModule.setup(swaggerPath, app, swaggerDocument);

  const port = process.env.PORT || 8080;
  await app.listen(port);
  logger.log(`Workspace service is running on port ${port}`);
  logger.log(`Swagger Docs: http://localhost:${port}/${swaggerPath}`, 'Bootstrap');
}
void bootstrap();
