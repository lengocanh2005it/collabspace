import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { IUnitOfWork, TransactionContext } from '../../domain/ports/unit-of-work.port';

@Injectable()
export class TypeOrmUnitOfWork implements IUnitOfWork {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async run<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => work({ manager }));
  }
}
