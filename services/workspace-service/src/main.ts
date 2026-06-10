import './observability/instrumentation';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './presentation/http/filters/global-exception.filter';
import { DatabaseService } from './infrastructure/database/database.service';
import { MetricsService } from './metrics/metrics.service';
import { registerMetricsMiddleware } from './metrics/register-metrics.middleware';
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  await app.get(DatabaseService).initialize();

  app.setGlobalPrefix('api/v1');
  registerMetricsMiddleware(app, app.get(MetricsService));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 8080;
  await app.listen(port);
  logger.log(`Workspace service is running on port ${port}`);
}
void bootstrap();
