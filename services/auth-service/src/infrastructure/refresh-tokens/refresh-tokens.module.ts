import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshTokenOrmEntity } from '@/infrastructure/database/entities/refresh-token.orm-entity';

@Module({
  imports: [TypeOrmModule.forFeature([RefreshTokenOrmEntity])],
  exports: [TypeOrmModule],
})
export class RefreshTokensModule {}
