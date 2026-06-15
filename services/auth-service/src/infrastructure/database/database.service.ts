import { Injectable } from '@nestjs/common';
import type { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService {
  constructor(private readonly dataSource: DataSource) {}

  get isInitialized(): boolean {
    return this.dataSource.isInitialized;
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }

  async destroy(): Promise<void> {
    if (!this.dataSource.isInitialized) {
      return;
    }

    await this.dataSource.destroy();
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
