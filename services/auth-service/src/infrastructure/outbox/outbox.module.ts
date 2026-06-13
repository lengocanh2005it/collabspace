import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database/database.module';
import { EmailsModule } from '@/infrastructure/emails/emails.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthOutboxProcessor } from './auth-outbox.processor';
import { AuthOutboxService } from './auth-outbox.service';
import { AuthOutboxEventOrmEntity } from '@/infrastructure/database/entities/auth-outbox-event.orm-entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthOutboxEventOrmEntity]),
    DatabaseModule,
    EmailsModule,
  ],
  providers: [AuthOutboxService, AuthOutboxProcessor],
  exports: [AuthOutboxService],
})
export class OutboxModule {}
