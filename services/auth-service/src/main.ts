import './observability/instrumentation';
import { assertRequiredInProduction, createServiceRateLimitMiddleware } from '@collabspace/shared';
import { ensureDatabaseUrl } from '@collabspace/typeorm-migrate';
import { ConfigurationService } from '@/configuration/configuration.service';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { MicroserviceOptions } from '@nestjs/microservices';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DatabaseService } from '@/infrastructure/database/database.service';
import { AppModule } from './app.module';
import { AuthHealthService } from './health/auth-health.service';
import { MetricsService } from './metrics/metrics.service';
import { registerRequestIdMiddleware } from './common/http/register-request-id.middleware';
import { registerMetricsMiddleware } from './metrics/register-metrics.middleware';
import compression from 'compression';

async function bootstrap() {
  ensureDatabaseUrl();
  assertRequiredInProduction('RESEND_API_KEY', process.env.RESEND_API_KEY);
  assertRequiredInProduction('SERVICE_JWT_SECRET', process.env.SERVICE_JWT_SECRET);

  const app = await NestFactory.create(AppModule);
  app.use(compression());
  app.use(createServiceRateLimitMiddleware());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  registerRequestIdMiddleware(app);
  registerMetricsMiddleware(app, app.get(MetricsService));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Auth Service API')
    .setDescription(
      'CollabSpace authentication: register, email OTP verification (cooldown + attempt limits), login, refresh tokens, gateway /verify.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  const swaggerPath = process.env.SWAGGER_UI_PATH?.trim() || 'swagger';
  if (process.env.SWAGGER_ENABLED !== 'false') {
    SwaggerModule.setup(swaggerPath, app, swaggerDocument);
  }

  await app.get(DatabaseService).initialize();
  const configurationService = app.get(ConfigurationService);
  let hasConnectedMicroservice = false;

  const grpcConfig = configurationService.getGrpcConfig();

  if (grpcConfig.enabled) {
    app.connectMicroservice<MicroserviceOptions>(configurationService.getGrpcMicroserviceOptions());
    hasConnectedMicroservice = true;
    Logger.log(`gRPC server configured on ${grpcConfig.url}`, 'Bootstrap');
  }

  if (hasConnectedMicroservice) {
    await app.startAllMicroservices();
  }

  const readiness = await app.get(AuthHealthService).getReadiness();
  Logger.log(
    `Startup mode=${readiness.mode} ready=${readiness.ready} checks=${Object.entries(
      readiness.checks,
    )
      .map(([name, check]) => `${name}:${check.status}`)
      .join(', ')}`,
    'Bootstrap',
  );

  const port = configurationService.getAppConfig().port;
  await app.listen(port);
  Logger.log(`HTTP Server: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Swagger Docs: http://localhost:${port}/${swaggerPath}`, 'Bootstrap');
}
void bootstrap();
