import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import envConfig from './env.config';
import { ConfigurationService } from './configuration.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
    }),
  ],
  providers: [ConfigurationService],
  exports: [ConfigModule, ConfigurationService],
})
export class ConfigurationModule {}
