import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import type { UserProfileUpdatedEventPayload } from '../../domain/events/user-profile-update.event';
import {
  USER_OUTBOX_AGGREGATE_TYPE,
  USER_OUTBOX_EVENT_PROFILE_UPDATED,
  UserOutboxEventEntity,
} from './entities/user-outbox-event.entity';

@Injectable()
export class UserOutboxService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async enqueueProfileUpdated(
    payload: UserProfileUpdatedEventPayload,
    manager?: EntityManager,
  ): Promise<void> {
    await this.enqueueEvent(USER_OUTBOX_EVENT_PROFILE_UPDATED, payload, manager);
  }

  private getRepository(manager?: EntityManager) {
    return (manager ?? this.dataSource.manager).getRepository(UserOutboxEventEntity);
  }

  private async enqueueEvent(
    eventType: string,
    payload: UserProfileUpdatedEventPayload,
    manager?: EntityManager,
  ): Promise<void> {
    const aggregateId = payload.userId;
    if (typeof aggregateId !== 'string' || aggregateId.length === 0) {
      throw new Error('User outbox payload must include userId');
    }

    const repository = this.getRepository(manager);
    await repository.save(
      repository.create({
        aggregateId,
        aggregateType: USER_OUTBOX_AGGREGATE_TYPE,
        attemptCount: 0,
        availableAt: new Date(),
        claimedAt: null,
        eventType,
        failedAt: null,
        id: randomUUID(),
        lastError: null,
        payload,
        processedAt: null,
      }),
    );
  }
}
