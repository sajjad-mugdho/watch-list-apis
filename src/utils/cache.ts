/**
 * Caching Utility
 * 
 * Provides a prefix-based, TTL-aware caching layer using Redis.
 * Supports generic types and automatic JSON serialization.
 */

import Redis from 'ioredis';
import { config } from '../config';
import logger from './logger';

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('connect', () => {
  logger.info('Connected to Redis for caching');
});

export const cache = {
  /**
   * Get a typed value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      logger.warn(`Cache get failed for key "${key}":`, error);
      return null;
    }
  },

  /**
   * Set a value in cache with a TTL
   */
  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    try {
      const data = JSON.stringify(value);
      await redis.setex(key, ttlSeconds, data);
    } catch (error) {
      logger.warn(`Cache set failed for key "${key}":`, error);
    }
  },

  /**
   * Delete a specific key
   */
  async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.warn(`Cache delete failed for key "${key}":`, error);
    }
  },

  /**
   * Delete multiple keys by pattern
   * WARNING: Use with caution as it uses KEYS command (or SCAN)
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Use SCAN for performance on large datasets
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
      
      logger.debug(`Invalidated cache pattern: ${pattern}`);
    } catch (error) {
      logger.warn(`Cache invalidation failed for pattern "${pattern}":`, error);
    }
  },

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    await redis.quit();
  }
};

export default cache;
