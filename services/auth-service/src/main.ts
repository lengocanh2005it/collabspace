import { ConfigurationService } from '@/configuration/configuration.service';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions } from '@nestjs/microservices';
import { NestFactory } from '@nestjs/core';
import { DatabaseService } from '@/modules/database/database.service';
import { AppModule } from './app.module';
import { AuthHealthService } from './health/auth-health.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
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

  await app.listen(configurationService.getAppConfig().port);
}
bootstrap();
