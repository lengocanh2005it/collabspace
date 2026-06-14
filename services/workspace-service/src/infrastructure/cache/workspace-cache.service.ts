import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { Workspace } from '../../domain/entities/workspace.entity';
import { REDIS_CLIENT } from './redis-client.token';

@Injectable()
export class WorkspaceCacheService {
  private readonly logger = new Logger(WorkspaceCacheService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null = null,
  ) {}

  // ── workspace by ID ───────────────────────────────────────────────────────

  async getWorkspace(id: string): Promise<Workspace | null | undefined> {
    return this.get<Workspace>(this.workspaceKey(id));
  }

  async setWorkspace(workspace: Workspace): Promise<void> {
    await this.set(this.workspaceKey(workspace.id), workspace, this.workspaceTtl());
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.del(this.workspaceKey(id));
  }

  // ── workspace list by member ──────────────────────────────────────────────

  async getWorkspaceList(userId: string): Promise<Workspace[] | undefined> {
    const result = await this.get<Workspace[]>(this.listKey(userId));
    return result === null ? undefined : result;
  }

  async setWorkspaceList(userId: string, workspaces: Workspace[]): Promise<void> {
    await this.set(this.listKey(userId), workspaces, this.listTtl());
  }

  async deleteWorkspaceList(userId: string): Promise<void> {
    await this.del(this.listKey(userId));
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async get<T>(key: string): Promise<T | null | undefined> {
    if (!this.redis) return undefined;
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return undefined;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Cache read error (${key})`, err instanceof Error ? err.message : String(err));
      return undefined;
    }
  }

  private async set(key: string, value: unknown, ttl: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (err) {
      this.logger.warn(`Cache write error (${key})`, err instanceof Error ? err.message : String(err));
    }
  }

  private async del(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`Cache delete error (${key})`, err instanceof Error ? err.message : String(err));
    }
  }

  private workspaceKey(id: string): string {
    return `workspace:${id}`;
  }

  private listKey(userId: string): string {
    return `workspace-list:${userId}`;
  }

  private workspaceTtl(): number {
    return Math.max(1, Number(this.configService.get<string>('WORKSPACE_CACHE_TTL_SECONDS') ?? 300));
  }

  private listTtl(): number {
    return Math.max(1, Number(this.configService.get<string>('WORKSPACE_LIST_CACHE_TTL_SECONDS') ?? 120));
  }
}
