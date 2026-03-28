/**
 * Networks Notification Service
 *
 * Business logic for networks platform notifications.
 * Handles: connections, orders, messages, reference checks, etc.
 */

import mongoose from "mongoose";
import { Notification } from "../../models/Notification";
import {
  NotificationCategory,
  resolveNotificationCategory,
} from "../constants/notificationTypes";

export interface CreateNotificationParams {
  userId: string;
  type: string;
  category?: NotificationCategory;
  title: string;
  body?: string;
  actionUrl?: string;
  data?: Record<string, any>;
  sendPush?: boolean;
}

export interface NotificationResponse {
  id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: Date;
  data?: Record<string, any>;
}

export class NetworksNotificationService {
  private buildFilter(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      types?: string[];
      categories?: NotificationCategory[];
    },
  ): Record<string, any> {
    const filter: Record<string, any> = {
      user_id: new mongoose.Types.ObjectId(userId),
      platform: "networks",
    };

    if (options?.unreadOnly) {
      filter.is_read = false;
    }
    if (options?.types && options.types.length > 0) {
      filter.type = { $in: options.types };
    }
    if (options?.categories && options.categories.length > 0) {
      filter.category = { $in: options.categories };
    }

    return filter;
  }

  /**
   * Create a networks platform notification
   */
  async create(
    params: CreateNotificationParams,
  ): Promise<NotificationResponse> {
    const { userId, type, category, title, body, actionUrl, data } = params;
    const resolvedCategory = category || resolveNotificationCategory(type);

    const created = await Notification.create({
      user_id: new mongoose.Types.ObjectId(userId),
      platform: "networks",
      type,
      category: resolvedCategory,
      title,
      body: body || null,
      action_url: actionUrl || null,
      data: data || null,
      is_read: false,
      read_at: null,
    });

    return {
      id: created._id.toString(),
      type: created.type,
      category: created.category,
      title: created.title,
      ...(created.body && { body: created.body }),
      ...(created.action_url && { actionUrl: created.action_url }),
      read: created.is_read,
      createdAt: created.createdAt,
      ...(created.data && { data: created.data }),
    };
  }

  /**
   * Get unread count for user's networks notifications
   */
  async getUnreadCount(
    userId: string,
    options?: { types?: string[]; categories?: NotificationCategory[] },
  ): Promise<number> {
    return Notification.countDocuments(
      this.buildFilter(userId, { unreadOnly: true, ...options }),
    );
  }

  async getTotalCount(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      types?: string[];
      categories?: NotificationCategory[];
    },
  ): Promise<number> {
    return Notification.countDocuments(this.buildFilter(userId, options));
  }

  /**
   * Get notifications for networks platform
   */
  async getForUser(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      types?: string[];
      categories?: NotificationCategory[];
    },
  ): Promise<NotificationResponse[]> {
    const filter = this.buildFilter(userId, options);

    const limit = Math.min(options?.limit ?? 20, 100);
    const offset = Math.max(options?.offset ?? 0, 0);

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    return notifications.map((n: any) => ({
      id: String(n._id),
      type: n.type,
      category: n.category,
      title: n.title,
      ...(n.body && { body: n.body }),
      ...(n.action_url && { actionUrl: n.action_url }),
      read: !!n.is_read,
      createdAt: n.createdAt,
      ...(n.data && { data: n.data }),
    }));
  }

  /**
   * Mark networks notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await Notification.findByIdAndUpdate(notificationId, {
      $set: { is_read: true, read_at: new Date() },
    });
  }

  /**
   * Mark all networks notifications as read
   */
  async markAllAsRead(
    userId: string,
    options?: { categories?: NotificationCategory[] },
  ): Promise<void> {
    await Notification.updateMany(
      this.buildFilter(userId, { unreadOnly: true, ...options }),
      {
        $set: { is_read: true, read_at: new Date() },
      },
    );
  }

  /**
   * Delete networks notification
   */
  async delete(notificationId: string): Promise<void> {
    await Notification.findByIdAndDelete(notificationId);
  }
}

export const networksNotificationService = new NetworksNotificationService();
