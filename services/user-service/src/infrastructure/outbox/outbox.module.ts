import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UNIT_OF_WORK } from '../../domain/ports/unit-of-work.port';
import { TypeOrmUnitOfWork } from '../database/typeorm-unit-of-work';
import { UserOutboxEventEntity } from './entities/user-outbox-event.entity';
import { UserOutboxService } from './user-outbox.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserOutboxEventEntity])],
  providers: [
    UserOutboxService,
    TypeOrmUnitOfWork,
    {
      provide: UNIT_OF_WORK,
      useExisting: TypeOrmUnitOfWork,
    },
  ],
  exports: [UserOutboxService, UNIT_OF_WORK],
})
export class OutboxModule {}
