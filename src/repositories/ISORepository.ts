/**
 * ISO Repository
 * 
 * Data access layer for ISO (In Search Of) operations.
 * Extends BaseRepository for standard CRUD operations.
 */

import { Types, FilterQuery } from 'mongoose';
import { BaseRepository, PaginatedResult } from './base/BaseRepository';
import { ISO, IISO, ISOStatus } from '../models/ISO';

export interface FindISOsParams {
  userId?: string;
  status?: ISOStatus | ISOStatus[];
  isPublic?: boolean;
  limit?: number;
  offset?: number;
}

export interface ISOQueryResult {
  isos: IISO[];
  total: number;
}

class ISORepository extends BaseRepository<IISO> {
  constructor() {
    super(ISO);
  }

  /**
   * Find ISOs by user ID
   */
  async findByUserId(
    userId: string, 
    status?: ISOStatus | ISOStatus[]
  ): Promise<IISO[]> {
    const filter: FilterQuery<IISO> = { 
      user_id: new Types.ObjectId(userId) 
    };
    
    if (status) {
      filter.status = Array.isArray(status) ? { $in: status } : status;
    }

    return this.find(filter, { sort: { createdAt: -1 } });
  }

  /**
   * Get user's active ISOs
   */
  async getActiveByUser(userId: string): Promise<IISO[]> {
    return this.findByUserId(userId, 'active');
  }

  /**
   * Count active ISOs for a user
   */
  async countActiveByUser(userId: string): Promise<number> {
    return this.count({
      user_id: new Types.ObjectId(userId),
      status: 'active',
    });
  }

  /**
   * Get public active ISOs (for discovery)
   */
  async getPublicActive(limit: number = 20, offset: number = 0): Promise<PaginatedResult<IISO>> {
    const filter: FilterQuery<IISO> = {
      status: 'active',
      is_public: true,
      $or: [
        { expires_at: null },
        { expires_at: { $gt: new Date() } },
      ],
    };

    const [data, total] = await Promise.all([
      this.find(filter, { 
        sort: { createdAt: -1 }, 
        skip: offset, 
        limit 
      }),
      this.count(filter),
    ]);

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + data.length < total,
    };
  }

  /**
   * Find expired ISOs (for cleanup job)
   */
  async findExpired(): Promise<IISO[]> {
    return this.find({
      status: 'active',
      expires_at: { $lt: new Date() },
    });
  }

  /**
   * Mark ISO as fulfilled
   */
  async markFulfilled(isoId: string): Promise<IISO | null> {
    return this.updateById(isoId, { status: 'fulfilled' });
  }

  /**
   * Mark ISO as closed
   */
  async close(isoId: string): Promise<IISO | null> {
    return this.updateById(isoId, { status: 'closed' });
  }

  /**
   * Search ISOs by text
   */
  async searchByText(
    query: string, 
    options?: { limit?: number; offset?: number }
  ): Promise<PaginatedResult<IISO>> {
    const filter: FilterQuery<IISO> = {
      $text: { $search: query },
      status: 'active',
      is_public: true,
    };

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const [data, total] = await Promise.all([
      this.find(filter, { 
        sort: { score: { $meta: 'textScore' } } as any,
        skip: offset, 
        limit 
      }),
      this.count(filter),
    ]);

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + data.length < total,
    };
  }
}

// Singleton instance
export const isoRepository = new ISORepository();
