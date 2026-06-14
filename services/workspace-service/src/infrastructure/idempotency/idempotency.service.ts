import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(IdempotencyService.name);

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

    if (!record) {
      return null;
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      await this.recordRepo.delete({ userId, idempotencyKey }).catch((err) => {
        this.logger.warn('Failed to delete expired idempotency record', err instanceof Error ? err.message : String(err));
      });
      return null;
    }

    return {
      body: record.responseBody,
      statusCode: record.statusCode,
    };
  }

  async pruneExpired(): Promise<number> {
    const result = await this.recordRepo
      .createQueryBuilder()
      .delete()
      .where('expires_at <= :now', { now: new Date() })
      .execute();
    return result.affected ?? 0;
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
