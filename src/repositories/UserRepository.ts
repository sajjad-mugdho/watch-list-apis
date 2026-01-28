/**
 * User Repository
 * 
 * Data access layer for user operations.
 */

import { Types } from 'mongoose';
import { BaseRepository } from './base/BaseRepository';
import { User, IUser } from '../models/User';

export interface UserSnapshot {
  _id: Types.ObjectId;
  name: string;
  avatar?: string;
}

class UserRepositoryClass extends BaseRepository<IUser> {
  constructor() {
    super(User);
  }

  /**
   * Find user by external ID (Clerk ID)
   */
  async findByExternalId(externalId: string): Promise<IUser | null> {
    return this.findOne({ external_id: externalId });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<IUser | null> {
    return this.findOne({ email: email.toLowerCase() });
  }

  /**
   * Update last seen timestamp
   */
  async updateLastSeen(userId: string): Promise<void> {
    await this.updateById(userId, { 
      last_seen: new Date(),
    } as any);
  }

  /**
   * Update message count and activity
   */
  async incrementMessageCount(userId: string): Promise<void> {
    await this.updateById(userId, {
      $inc: { message_count: 1 },
      $set: { last_message_at: new Date() },
    } as any);
  }

  /**
   * Create user snapshot for denormalization
   */
  async createSnapshot(userId: string): Promise<UserSnapshot | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    return {
      _id: user._id as Types.ObjectId,
      name: user.display_name || user.first_name || 'User',
      ...(user.avatar ? { avatar: user.avatar } : {}),
    };
  }

  /**
   * Find multiple users by IDs
   */
  async findByIds(userIds: string[]): Promise<IUser[]> {
    return this.find({
      _id: { $in: userIds.map(id => new Types.ObjectId(id)) },
    });
  }

  /**
   * Get basic user info for display (minimal fields)
   */
  async getDisplayInfo(userId: string): Promise<{
    id: string;
    name: string;
    avatar?: string;
  } | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    return {
      id: user._id.toString(),
      name: user.display_name || user.first_name || 'User',
      ...(user.avatar ? { avatar: user.avatar } : {}),
    };
  }

  /**
   * Check if user exists
   */
  async userExists(userId: string): Promise<boolean> {
    return this.exists({ _id: new Types.ObjectId(userId) });
  }
}

// Singleton instance
export const userRepository = new UserRepositoryClass();
export { UserRepositoryClass as UserRepository };
