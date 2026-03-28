import mongoose, { Document, Schema, Types } from "mongoose";
import {
  NOTIFICATION_CATEGORY_VALUES,
  NotificationCategory,
} from "../networks/constants/notificationTypes";

export const NOTIFICATION_PLATFORM_VALUES = [
  "networks",
  "marketplace",
] as const;
export type NotificationPlatform =
  (typeof NOTIFICATION_PLATFORM_VALUES)[number];

export interface INotification extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  platform: NotificationPlatform;
  type: string;
  category: NotificationCategory;
  title: string;
  body?: string | null;
  action_url?: string | null;
  data?: Record<string, any> | null;
  is_read: boolean;
  read_at?: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: NOTIFICATION_PLATFORM_VALUES,
      required: true,
      index: true,
    },
    type: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: NOTIFICATION_CATEGORY_VALUES,
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: null },
    action_url: { type: String, default: null },
    data: { type: Schema.Types.Mixed, default: null },
    is_read: { type: Boolean, default: false, index: true },
    read_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

notificationSchema.index({ user_id: 1, platform: 1, createdAt: -1 });
notificationSchema.index({
  user_id: 1,
  platform: 1,
  is_read: 1,
  createdAt: -1,
});
notificationSchema.index({
  user_id: 1,
  platform: 1,
  category: 1,
  createdAt: -1,
});

notificationSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.user_id = ret.user_id?.toString?.();
    return ret;
  },
});

export const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema,
  "notifications",
);

export default Notification;
