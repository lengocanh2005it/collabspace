import { Module } from '@nestjs/common';
import { ConfigurationService } from '@/configuration/configuration.service';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseService } from './database.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigurationService],
      useFactory: (configurationService: ConfigurationService): TypeOrmModuleOptions =>
        configurationService.getDatabaseModuleOptions(),
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}
