/**
 * Watch Catalog Caching Service
 * Long-term caching with smart invalidation
 * - 24-hour TTL by default
 * - Automatic cleanup every hour
 * - Platform-specific caches: public, networks, marketplace
 * - Size management: 500MB max with LRU eviction
 */

import logger from "../utils/logger";

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  size: number;
  queryParams: Record<string, any>;
}

class WatchCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB
  private readonly CACHE_KEY_PREFIX = "watches";
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor() {
    this.startCleanupInterval();
    logger.info("[WatchCache] Service initialized", {
      defaultTTL: "24h",
      maxSize: "500MB",
    });
  }

  private generateCacheKey(
    platform: "public" | "networks" | "marketplace",
    params: Record<string, any>,
  ): string {
    const sortedParams = Object.keys(params)
      .filter(
        (k) =>
          params[k] !== undefined && params[k] !== null && params[k] !== "",
      )
      .sort()
      .map((k) => `${k}=${JSON.stringify(params[k])}`)
      .join("&");

    const hash = Buffer.from(sortedParams).toString("base64").substring(0, 20);
    return `${this.CACHE_KEY_PREFIX}:${platform}:${hash}`;
  }

  get<T>(
    platform: "public" | "networks" | "marketplace",
    params: Record<string, any>,
  ): { data: T; cached: true; age: number; hitCount: number } | null {
    const key = this.generateCacheKey(platform, params);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    entry.hitCount++;
    const age = Math.floor((Date.now() - entry.createdAt) / 1000);

    logger.debug("[WatchCache] HIT", {
      platform,
      age: `${age}s`,
      hits: entry.hitCount,
    });

    return {
      data: entry.data as T,
      cached: true,
      age,
      hitCount: entry.hitCount,
    };
  }

  set<T>(
    platform: "public" | "networks" | "marketplace",
    params: Record<string, any>,
    data: T,
    ttlMs?: number,
  ): void {
    const key = this.generateCacheKey(platform, params);
    const size = JSON.stringify(data).length;
    const expiresAt = Date.now() + (ttlMs || this.DEFAULT_TTL);

    const currentSize = Array.from(this.cache.values()).reduce(
      (sum, e) => sum + e.size,
      0,
    );

    if (currentSize + size > this.MAX_CACHE_SIZE) {
      const sorted = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].createdAt - b[1].createdAt,
      );

      let freedSize = 0;
      const targetSize = this.MAX_CACHE_SIZE * 0.8;
      for (const [cacheKey] of sorted) {
        const entrySize = this.cache.get(cacheKey)?.size ?? 0;
        this.cache.delete(cacheKey);
        freedSize += entrySize;
        if (currentSize - freedSize + size <= targetSize) break;
      }
    }

    this.cache.set(key, {
      data,
      createdAt: Date.now(),
      expiresAt,
      hitCount: 0,
      size,
      queryParams: params,
    });
  }

  invalidate(platform?: "public" | "networks" | "marketplace"): number {
    let count = 0;
    if (platform) {
      for (const [key] of this.cache.entries()) {
        if (key.includes(`:${platform}:`)) {
          this.cache.delete(key);
          count++;
        }
      }
    } else {
      count = this.cache.size;
      this.cache.clear();
    }
    logger.info("[WatchCache] INVALIDATED", {
      platform: platform || "all",
      count,
    });
    return count;
  }

  invalidateByCategory(category: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (
        !entry.queryParams.category ||
        entry.queryParams.category === category
      ) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  invalidateByBrand(brand: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      const hasBrand =
        !entry.queryParams.brand ||
        entry.queryParams.brand === brand ||
        (Array.isArray(entry.queryParams.brands) &&
          entry.queryParams.brands.includes(brand));
      if (hasBrand) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  getStats() {
    const now = Date.now();
    const size = Array.from(this.cache.values()).reduce(
      (sum, e) => sum + e.size,
      0,
    );
    const utilizationPercent = (size / this.MAX_CACHE_SIZE) * 100;

    const cacheEntries = Array.from(this.cache.entries()).map(
      ([key, entry]) => ({
        key: key.substring(0, 40),
        platform: key.split(":")[1],
        ageSeconds: Math.floor((now - entry.createdAt) / 1000),
        expiresInSeconds: Math.floor((entry.expiresAt - now) / 1000),
        hits: entry.hitCount,
        sizeKB: Math.round(entry.size / 1024),
      }),
    );

    return {
      status:
        utilizationPercent > 90
          ? "critical"
          : utilizationPercent > 70
            ? "warning"
            : "healthy",
      entries: this.cache.size,
      sizeInMB: Math.round((size / 1024 / 1024) * 100) / 100,
      maxSizeInMB: 500,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
      cacheEntries,
    };
  }

  clear(): number {
    const count = this.cache.size;
    this.cache.clear();
    logger.info("[WatchCache] CLEARED", { count });
    return count;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(
      () => {
        let cleaned = 0;
        const now = Date.now();

        for (const [key, entry] of this.cache.entries()) {
          if (now > entry.expiresAt) {
            this.cache.delete(key);
            cleaned++;
          }
        }

        if (cleaned > 0) {
          logger.debug("[WatchCache] CLEANUP", { cleaned });
        }
      },
      60 * 60 * 1000,
    ) as NodeJS.Timer; // Every 1 hour
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval as any);
      this.cleanupInterval = null;
    }
  }
}

export const watchCacheService = new WatchCacheService();
