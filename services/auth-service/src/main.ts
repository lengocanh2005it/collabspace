import { ConfigurationService } from '@/configuration/configuration.service';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions } from '@nestjs/microservices';
import { NestFactory } from '@nestjs/core';
import { DatabaseService } from '@/modules/database/database.service';
import { AppModule } from './app.module';

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

  await app.listen(configurationService.getAppConfig().port);
}
bootstrap();
