import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyRecordOrmEntity } from './entities/idempotency-record.orm-entity';

export type CachedIdempotentResponse = {
  body: Record<string, unknown>;
  statusCode: number;
};

const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyRecordOrmEntity)
    private readonly recordRepo: Repository<IdempotencyRecordOrmEntity>,
  ) {}

  async findCached(
    userId: string,
    idempotencyKey: string,
  ): Promise<CachedIdempotentResponse | null> {
    const record = await this.recordRepo.findOne({
      where: { userId, idempotencyKey },
    });

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return {
      body: record.responseBody,
      statusCode: record.statusCode,
    };
  }

  async store(
    userId: string,
    idempotencyKey: string,
    route: string,
    statusCode: number,
    responseBody: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.recordRepo.save(
        this.recordRepo.create({
          expiresAt: new Date(Date.now() + TTL_MS),
          idempotencyKey,
          responseBody,
          route,
          statusCode,
          userId,
        }),
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
      ) {
        return;
      }

      throw error;
    }
  }
}
