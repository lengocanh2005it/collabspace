import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database/database.module';
import { EmailsModule } from '@/infrastructure/emails/emails.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthOutboxProcessor } from './auth-outbox.processor';
import { AuthOutboxService } from './auth-outbox.service';
import { AuthOutboxEventEntity } from './entities/auth-outbox-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthOutboxEventEntity]),
    DatabaseModule,
    EmailsModule,
  ],
  providers: [AuthOutboxService, AuthOutboxProcessor],
  exports: [AuthOutboxService],
})
export class OutboxModule {}
