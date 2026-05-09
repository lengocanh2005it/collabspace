import { ConfigurationService } from '@/configuration/configuration.service';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions } from '@nestjs/microservices';
import { NestFactory } from '@nestjs/core';
import { DatabaseService } from '@/modules/database/database.service';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.get(DatabaseService).initialize();
  const configurationService = app.get(ConfigurationService);

  const grpcConfig = configurationService.getGrpcConfig();

  if (grpcConfig.enabled) {
    app.connectMicroservice<MicroserviceOptions>(
      configurationService.getGrpcMicroserviceOptions(),
    );

    await app.startAllMicroservices();
    Logger.log(`gRPC server listening on ${grpcConfig.url}`, 'Bootstrap');
  }

  await app.listen(configurationService.getAppConfig().port);
}
bootstrap();
