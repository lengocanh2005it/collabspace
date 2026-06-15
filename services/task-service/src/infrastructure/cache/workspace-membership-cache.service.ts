import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Redis } from "ioredis";
import type { WorkspaceMembershipSnapshot } from "../../application/ports/IWorkspaceClient";
import { REDIS_CLIENT } from "./redis-client.token";

const NEGATIVE_SENTINEL = "__null__";

@Injectable()
export class WorkspaceMembershipCacheService {
  private readonly logger = new Logger(WorkspaceMembershipCacheService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis | null = null,
  ) {}

  async read(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipSnapshot | null | undefined> {
    if (!this.isEnabled()) return undefined;

    try {
      const raw = await this.redis?.get(this.cacheKey(workspaceId, userId));
      if (raw == null) return undefined;
      if (raw === NEGATIVE_SENTINEL) return null;
      return JSON.parse(raw) as WorkspaceMembershipSnapshot;
    } catch (err) {
      this.logger.warn(
        "Workspace membership cache read error",
        err instanceof Error ? err.message : String(err),
      );
      return undefined;
    }
  }

  async write(
    workspaceId: string,
    userId: string,
    snapshot: WorkspaceMembershipSnapshot | null,
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const ttl = snapshot === null ? this.negativeTtlSeconds() : this.ttlSeconds();
    const value = snapshot === null ? NEGATIVE_SENTINEL : JSON.stringify(snapshot);

    try {
      await this.redis?.setex(this.cacheKey(workspaceId, userId), ttl, value);
    } catch (err) {
      this.logger.warn(
        "Workspace membership cache write error",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  async clear(workspaceId?: string, userId?: string): Promise<void> {
    if (!this.isEnabled()) return;
    if (workspaceId && userId) {
      try {
        await this.redis?.del(this.cacheKey(workspaceId, userId));
      } catch (err) {
        this.logger.warn(
          "Workspace membership cache clear error",
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  private isEnabled(): boolean {
    if (this.configService.get<string>("WORKSPACE_MEMBERSHIP_CACHE_ENABLED") === "false") {
      return false;
    }
    return this.redis !== null;
  }

  private cacheKey(workspaceId: string, userId: string): string {
    return `workspace-member:${workspaceId}:${userId}`;
  }

  private ttlSeconds(): number {
    return Math.max(
      1,
      Number(this.configService.get<string>("WORKSPACE_MEMBERSHIP_CACHE_TTL_SECONDS") ?? 60),
    );
  }

  private negativeTtlSeconds(): number {
    return Math.max(
      1,
      Number(
        this.configService.get<string>("WORKSPACE_MEMBERSHIP_NEGATIVE_CACHE_TTL_SECONDS") ?? 15,
      ),
    );
  }
}
