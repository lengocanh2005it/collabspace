import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService {
  constructor(private readonly dataSource: DataSource) {}

  get isInitialized(): boolean {
    return this.dataSource.isInitialized;
  }

  async initialize(): Promise<DataSource> {
    if (this.dataSource.isInitialized) {
      return this.dataSource;
    }

    return this.dataSource.initialize();
  }

  async ping(): Promise<boolean> {
    if (!this.dataSource.isInitialized) {
      return false;
    }

    await this.dataSource.query('SELECT 1');
    return true;
  }
}
