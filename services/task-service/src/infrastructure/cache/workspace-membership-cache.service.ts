import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WorkspaceMembershipSnapshot } from "../../application/ports/IWorkspaceClient";

type CacheEntry = {
  value: WorkspaceMembershipSnapshot | null;
  expiresAt: number;
};

@Injectable()
export class WorkspaceMembershipCacheService {
  private readonly logger = new Logger(WorkspaceMembershipCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly configService: ConfigService) {}

  read(
    workspaceId: string,
    userId: string,
  ): WorkspaceMembershipSnapshot | null | undefined {
    if (!this.isEnabled()) {
      return undefined;
    }

    const key = this.cacheKey(workspaceId, userId);
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  write(
    workspaceId: string,
    userId: string,
    snapshot: WorkspaceMembershipSnapshot | null,
  ): void {
    if (!this.isEnabled()) {
      return;
    }

    this.evictIfNeeded();
    this.cache.set(this.cacheKey(workspaceId, userId), {
      value: snapshot,
      expiresAt: Date.now() + this.ttlMs(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  private isEnabled(): boolean {
    return (
      this.configService.get<string>("WORKSPACE_MEMBERSHIP_CACHE_ENABLED") !==
      "false"
    );
  }

  private ttlMs(): number {
    const ttlSeconds = Number(
      this.configService.get<string>(
        "WORKSPACE_MEMBERSHIP_CACHE_TTL_SECONDS",
      ) ?? 60,
    );

    return Math.max(1, Math.floor(ttlSeconds)) * 1000;
  }

  private maxEntries(): number {
    const maxEntries = Number(
      this.configService.get<string>(
        "WORKSPACE_MEMBERSHIP_CACHE_MAX_ENTRIES",
      ) ?? 2000,
    );

    return Math.max(100, Math.floor(maxEntries));
  }

  private cacheKey(workspaceId: string, userId: string): string {
    return `${workspaceId}:${userId}`;
  }

  private evictIfNeeded(): void {
    const maxEntries = this.maxEntries();
    if (this.cache.size < maxEntries) {
      return;
    }

    const overflow = this.cache.size - maxEntries + 1;
    const keys = this.cache.keys();
    for (let index = 0; index < overflow; index += 1) {
      const next = keys.next();
      if (next.done) {
        break;
      }
      this.cache.delete(next.value);
    }

    this.logger.debug(
      `Evicted ${overflow} workspace membership cache entries (max ${maxEntries})`,
    );
  }
}
