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
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  await app.get(DatabaseService).initialize();

  app.setGlobalPrefix('api/v1');
  registerRequestIdMiddleware(app);
  registerMetricsMiddleware(app, app.get(MetricsService));

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
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Internal-Service-Token',
      },
      'internal-service-token',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, swaggerDocument);

  const port = process.env.PORT || 8080;
  await app.listen(port);
  logger.log(`Workspace service is running on port ${port}`);
  logger.log(`Swagger Docs: http://localhost:${port}/swagger`, 'Bootstrap');
}
void bootstrap();
