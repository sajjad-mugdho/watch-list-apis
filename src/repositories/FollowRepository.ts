/**
 * Follow Repository
 * 
 * Data access layer for follow relationships.
 * Extends BaseRepository for standard CRUD operations.
 * 
 * NOTE: Follow model uses following_id (not followee_id)
 * There is no status field - follows are deleted when unfollowed
 */

import { Types, FilterQuery } from 'mongoose';
import { BaseRepository, PaginatedResult } from './base/BaseRepository';
import { Follow, IFollow } from '../models/Follow';

class FollowRepository extends BaseRepository<IFollow> {
  constructor() {
    super(Follow as any);
  }

  /**
   * Find follow relationship between two users
   */
  async findByUsers(followerId: string, followingId: string): Promise<IFollow | null> {
    return this.findOne({
      follower_id: new Types.ObjectId(followerId),
      following_id: new Types.ObjectId(followingId),
    });
  }

  /**
   * Get followers of a user
   */
  async getFollowers(
    userId: string, 
    options?: { limit?: number; offset?: number }
  ): Promise<PaginatedResult<IFollow>> {
    const filter: FilterQuery<IFollow> = {
      following_id: new Types.ObjectId(userId),
    };

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

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
   * Get users that a user is following
   */
  async getFollowing(
    userId: string, 
    options?: { limit?: number; offset?: number }
  ): Promise<PaginatedResult<IFollow>> {
    const filter: FilterQuery<IFollow> = {
      follower_id: new Types.ObjectId(userId),
    };

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

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
   * Count followers
   */
  async countFollowers(userId: string): Promise<number> {
    return this.count({
      following_id: new Types.ObjectId(userId),
    });
  }

  /**
   * Count following
   */
  async countFollowing(userId: string): Promise<number> {
    return this.count({
      follower_id: new Types.ObjectId(userId),
    });
  }

  /**
   * Check if user A follows user B
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.findByUsers(followerId, followingId);
    return !!follow;
  }

  /**
   * Create follow relationship
   */
  async createFollow(followerId: string, followingId: string): Promise<IFollow> {
    // Check for existing follow
    const existing = await this.findByUsers(followerId, followingId);
    
    if (existing) {
      return existing;
    }

    return this.create({
      follower_id: new Types.ObjectId(followerId),
      following_id: new Types.ObjectId(followingId),
    } as any);
  }

  /**
   * Remove follow (hard delete since there's no status field)
   */
  async unfollow(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.findByUsers(followerId, followingId);
    if (!follow) {
      return false;
    }
    
    await this.deleteById(follow._id.toString());
    return true;
  }
}

// Singleton instance
export const followRepository = new FollowRepository();
