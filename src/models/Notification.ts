/**
 * Notification Model
 *
 * Stores in-app notifications for users.
 * Used for reference checks, ISO matches, offer updates, etc.
 */

import mongoose, { Document, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export const NOTIFICATION_TYPES = [
  // ISO & Reference Checks
  "iso_match",
  "reference_check_request",
  "reference_check_response",
  
  // Offers
  "offer_received",
  "offer_accepted",
  "offer_rejected",
  "counter_offer",
  "offer_expired",
  
  // Order Lifecycle
  "order_update",
  "order_created",
  "order_paid",
  "order_shipped",
  "order_delivered",
  "order_completed",
  "order_cancelled",
  "order_refunded",
  
  // Social
  "new_follower",
  "follow_received",
  "new_message",
  "mention_received",
  
  // Listings
  "listing_sold",
  "listing_created",
  "listing_published",
  "listing_viewed",
  "listing_favorited",
  "price_drop_alert",
  
  // Welcome & Onboarding
  "welcome",
  "onboarding_complete",
  "profile_incomplete_reminder",
  
  // System
  "system",
  
  // ===== New Notification Types =====
  
  // Reviews
  "review_received",      // When someone leaves you a review
  "review_reminder",      // Prompts user to review after order delivered
  
  // Friendship
  "friend_request_received",
  "friend_request_accepted",
  "friend_request_declined",
  
  // Support Tickets (optional)
  "ticket_created",
  "ticket_updated",
  "ticket_response",
  "ticket_resolved",
  
  // WTB Matching
  "wtb_match_found",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------

export interface INotification extends Document {
  _id: Types.ObjectId;

  // Who receives this notification
  user_id: Types.ObjectId;
  clerk_id?: string;

  // Notification content
  type: NotificationType;
  title: string;
  body: string;
  icon?: string;

  // Related resources
  data?: {
    listing_id?: string;
    order_id?: string;
    offer_id?: string;
    iso_id?: string;
    reference_check_id?: string;
    channel_id?: string;
    user_id?: string;
    [key: string]: any;
  };

  // Action
  action_url?: string;

  // Status
  is_read: boolean;
  read_at?: Date;

  // Push notification tracking
  push_sent: boolean;
  push_sent_at?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------

const NotificationSchema = new Schema<INotification>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clerk_id: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      maxlength: 500,
    },
    icon: {
      type: String,
      default: null,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    action_url: {
      type: String,
      default: null,
    },
    is_read: {
      type: Boolean,
      default: false,
      index: true,
    },
    read_at: {
      type: Date,
      default: null,
    },
    push_sent: {
      type: Boolean,
      default: false,
    },
    push_sent_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
NotificationSchema.index({ user_id: 1, createdAt: -1 });
NotificationSchema.index({ user_id: 1, is_read: 1, createdAt: -1 });
NotificationSchema.index({ user_id: 1, type: 1, createdAt: -1 });

// ----------------------------------------------------------
// Statics
// ----------------------------------------------------------

interface INotificationModel extends mongoose.Model<INotification> {
  getUnreadCount(userId: string): Promise<number>;
  markAsRead(notificationId: string): Promise<INotification | null>;
  markAllAsRead(userId: string): Promise<number>;
  getForUser(
    userId: string,
    options?: { limit?: number; offset?: number; unreadOnly?: boolean }
  ): Promise<INotification[]>;
}

NotificationSchema.statics.getUnreadCount = async function (
  userId: string
): Promise<number> {
  return this.countDocuments({
    user_id: userId,
    is_read: false,
  });
};

NotificationSchema.statics.markAsRead = async function (
  notificationId: string
): Promise<INotification | null> {
  return this.findByIdAndUpdate(
    notificationId,
    {
      is_read: true,
      read_at: new Date(),
    },
    { new: true }
  );
};

NotificationSchema.statics.markAllAsRead = async function (
  userId: string
): Promise<number> {
  const result = await this.updateMany(
    { user_id: userId, is_read: false },
    { is_read: true, read_at: new Date() }
  );
  return result.modifiedCount;
};

NotificationSchema.statics.getForUser = async function (
  userId: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<INotification[]> {
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  const query: any = { user_id: userId };
  if (unreadOnly) {
    query.is_read = false;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

// Transform for JSON
NotificationSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.user_id = ret.user_id?.toString?.();
    return ret;
  },
});

export const Notification = mongoose.model<INotification, INotificationModel>(
  "Notification",
  NotificationSchema,
  "notifications"
);

export default Notification;
