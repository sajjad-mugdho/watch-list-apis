/**
 * Notification Repository
 * 
 * Data access layer for in-app notifications.
 */

import { Types } from 'mongoose';
import { BaseRepository, PaginatedResult } from './base/BaseRepository';
import { Notification, INotification } from '../models/Notification';

export interface FindNotificationsParams {
  userId: string;
  unreadOnly?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  data?: Record<string, any>;
}

class NotificationRepositoryClass extends BaseRepository<INotification> {
  constructor() {
    super(Notification);
  }

  /**
   * Find notifications for a user
   */
  async findForUser(params: FindNotificationsParams): Promise<PaginatedResult<INotification>> {
    const { userId, unreadOnly, type, limit = 20, offset = 0 } = params;

    const filter: any = { user_id: new Types.ObjectId(userId) };
    
    if (unreadOnly) {
      filter.is_read = false;
    }
    
    if (type) {
      filter.type = type;
    }

    return this.findPaginated(filter, { limit, offset, sort: { createdAt: -1 } });
  }

  /**
   * Create a notification
   */
  async createNotification(params: CreateNotificationParams): Promise<INotification> {
    return this.create({
      user_id: new Types.ObjectId(params.userId),
      type: params.type,
      title: params.title,
      body: params.body,
      action_url: params.actionUrl,
      data: params.data || {},
      is_read: false,
    } as any);
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string): Promise<INotification | null> {
    return this.updateById(notificationId, { 
      is_read: true,
      read_at: new Date(),
    } as any);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    return this.updateMany(
      { 
        user_id: new Types.ObjectId(userId), 
        is_read: false 
      },
      { 
        is_read: true, 
        read_at: new Date() 
      } as any
    );
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.count({
      user_id: new Types.ObjectId(userId),
      is_read: false,
    });
  }

  /**
   * Delete old notifications (for cleanup job)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.deleteMany({
      createdAt: { $lt: cutoffDate },
      is_read: true, // Only delete read notifications
    });
  }

  /**
   * Find by type for a user
   */
  async findByType(userId: string, type: string): Promise<INotification[]> {
    return this.find(
      { 
        user_id: new Types.ObjectId(userId), 
        type 
      },
      { sort: { createdAt: -1 }, limit: 20 }
    );
  }
}

// Singleton instance
export const notificationRepository = new NotificationRepositoryClass();
export { NotificationRepositoryClass as NotificationRepository };
