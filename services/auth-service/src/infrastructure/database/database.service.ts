import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

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

  async assertRequiredTables(requiredTables: string[]): Promise<void> {
    if (!this.dataSource.isInitialized) {
      throw new Error('Database is not initialized');
    }

    const rows = await this.dataSource.query<Array<{ table_name: string }>>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name = ANY($1)`,
      [requiredTables],
    );
    const existingTables = new Set(rows.map((row) => row.table_name));
    const missingTables = requiredTables.filter((table) => !existingTables.has(table));

    if (missingTables.length > 0) {
      throw new Error(`Missing required database tables: ${missingTables.join(', ')}`);
    }
  }
}
