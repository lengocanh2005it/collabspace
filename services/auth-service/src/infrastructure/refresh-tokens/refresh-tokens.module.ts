import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshTokenEntity } from './entities/refresh-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RefreshTokenEntity])],
  exports: [TypeOrmModule],
})
export class RefreshTokensModule {}
