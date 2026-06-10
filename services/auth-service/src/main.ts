import { ConfigurationService } from '@/configuration/configuration.service';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions } from '@nestjs/microservices';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DatabaseService } from '@/modules/database/database.service';
import { AppModule } from './app.module';
import { AuthHealthService } from './health/auth-health.service';
import { MetricsService } from './metrics/metrics.service';
import { registerMetricsMiddleware } from './metrics/register-metrics.middleware';
import { bootstrapTracing } from './observability/tracing';

async function bootstrap() {
  bootstrapTracing('auth-service');
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  registerMetricsMiddleware(app, app.get(MetricsService));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Auth Service API')
    .setDescription('CollabSpace Auth Service')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, swaggerDocument);

  await app.get(DatabaseService).initialize();
  const configurationService = app.get(ConfigurationService);
  let hasConnectedMicroservice = false;

  const grpcConfig = configurationService.getGrpcConfig();

  if (grpcConfig.enabled) {
    app.connectMicroservice<MicroserviceOptions>(
      configurationService.getGrpcMicroserviceOptions(),
    );
    hasConnectedMicroservice = true;
    Logger.log(`gRPC server configured on ${grpcConfig.url}`, 'Bootstrap');
  }

  const rabbitMqConfig = configurationService.getRabbitMqConfig();

  if (rabbitMqConfig.enabled && rabbitMqConfig.url) {
    app.connectMicroservice<MicroserviceOptions>(
      configurationService.getRabbitMqMicroserviceOptions(),
    );
    hasConnectedMicroservice = true;
    Logger.log(
      `RabbitMQ consumer configured for queue ${rabbitMqConfig.queue}`,
      'Bootstrap',
    );
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
  Logger.log(`Swagger Docs: http://localhost:${port}/swagger`, 'Bootstrap');
}
bootstrap();
