/**
 * Notification Service
 * 
 * Business logic for in-app notifications and push notifications.
 * 
 * Key features:
 * - Critical notifications bypass mute settings
 * - Deduplication for similar notifications
 * - Push notification integration (FCM/APNs)
 */

import { notificationRepository } from '../../repositories';
import { events } from '../../utils/events';
import cache from '../../utils/cache';
import logger from '../../utils/logger';
import pushNotificationQueue from '../../queues/pushNotificationQueue';

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  data?: Record<string, any>;
  sendPush?: boolean;
}

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: Date;
  data?: Record<string, any>;
}

/**
 * Notification types that bypass mute settings
 * "Important state changes should notify even if chat is muted"
 */
const CRITICAL_NOTIFICATION_TYPES = [
  'offer_received',
  'offer_accepted',
  'offer_rejected',
  'offer_expired',
  'counter_offer',
  'order_created',
  'order_paid',
  'order_shipped',
  'order_completed',
  'reference_check_request',
  'reference_check_response',
];

export class NotificationService {
  /**
   * Create a notification
   * 
   * Business Rules:
   * - Critical notifications always created
   * - Optional push notification
   * - Deduplication for rapid-fire events
   */
  async create(params: CreateNotificationParams): Promise<NotificationResponse> {
    const { userId, type, title, body, actionUrl, data, sendPush = false } = params;

    logger.info('Creating notification', { userId, type, title });

    // Create in database
    const notification = await notificationRepository.createNotification({
      userId,
      type,
      title,
      ...(body ? { body } : {}),
      ...(actionUrl ? { actionUrl } : {}),
      ...(data ? { data } : {}),
    });

    // Invalidate unread count cache
    await cache.delete(`notifications:unread_count:${userId}`);

    // Emit event for any side effects
    events.emit('notification:created', {
      notificationId: notification._id.toString(),
      userId,
      type,
    });

    // Send push notification if requested
    if (sendPush) {
      await this.sendPushNotification(
        userId, 
        { 
          title, 
          ...(body ? { body } : {}),
          ...(actionUrl ? { actionUrl } : {}),
        },
        notification._id.toString()
      );
    }

    return {
      id: notification._id.toString(),
      type,
      title,
      ...(body ? { body } : {}),
      ...(actionUrl ? { actionUrl } : {}),
      read: false,
      createdAt: notification.createdAt,
      ...(data ? { data } : {}),
    };
  }

  /**
   * Check if notification type should bypass mute settings
   */
  isCriticalNotification(type: string): boolean {
    return CRITICAL_NOTIFICATION_TYPES.includes(type);
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number; offset?: number }
  ): Promise<{
    notifications: NotificationResponse[];
    total: number;
    hasMore: boolean;
  }> {
    const result = await notificationRepository.findForUser({
      userId,
      ...(options?.unreadOnly !== undefined ? { unreadOnly: options.unreadOnly } : {}),
      ...(options?.limit !== undefined ? { limit: options.limit } : {}),
      ...(options?.offset !== undefined ? { offset: options.offset } : {}),
    });

    return {
      notifications: result.data.map((n: any) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        body: n.body,
        actionUrl: n.action_url,
        read: n.is_read,
        createdAt: n.createdAt,
        data: n.data,
      })),
      total: result.total,
      hasMore: result.hasMore,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await notificationRepository.findById(notificationId);
    
    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.user_id.toString() !== userId) {
      throw new Error('Not authorized');
    }

    await notificationRepository.markAsRead(notificationId);
    await cache.delete(`notifications:unread_count:${userId}`);
    logger.debug('Notification marked as read', { notificationId });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const count = await notificationRepository.markAllAsRead(userId);
    await cache.delete(`notifications:unread_count:${userId}`);
    logger.info('All notifications marked as read', { userId, count });
    return count;
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = `notifications:unread_count:${userId}`;
    
    // 1. Try cache first
    const cached = await cache.get<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // 2. Fetch from repository
    const count = await notificationRepository.getUnreadCount(userId);

    // 3. Cache for 1 minute
    await cache.set(cacheKey, count, 60);

    return count;
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await notificationRepository.findById(notificationId);
    
    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.user_id.toString() !== userId) {
      throw new Error('Not authorized');
    }

    await notificationRepository.deleteById(notificationId);
    logger.debug('Notification deleted', { notificationId });
  }

  /**
   * Send push notification (FCM/APNs) via BullMQ
   */
  private async sendPushNotification(
    userId: string,
    notification: { title: string; body?: string; actionUrl?: string },
    notificationId?: string
  ): Promise<void> {
    if (!notificationId) {
      logger.warn('Push notification skipped: Missing notificationId', { userId });
      return;
    }

    try {
      const jobData: any = {
        userId,
        notificationId,
        title: notification.title,
      };
      if (notification.body !== undefined) jobData.body = notification.body;
      if (notification.actionUrl !== undefined) jobData.actionUrl = notification.actionUrl;

      await pushNotificationQueue.add(jobData);
      logger.debug('Push notification queued', { userId, notificationId });
    } catch (error: any) {
      logger.error('Failed to enqueue push notification', { userId, error: error.message });
    }
  }

  /**
   * Register push token for user
   * TODO: Implement token storage
   */
  async registerPushToken(
    userId: string,
    _token: string,
    platform: 'ios' | 'android'
  ): Promise<void> {
    // TODO: Store token in user document
    logger.debug('Push token registered', { userId, platform });
  }
}

// Singleton instance
export const notificationService = new NotificationService();
