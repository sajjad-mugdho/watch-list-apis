import mongoose, { Document, Schema, Types } from "mongoose";

export const PLATFORM_TYPES = ["ios", "android", "web"] as const;
export type PlatformType = (typeof PLATFORM_TYPES)[number];

export interface IDeviceToken extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  token: string;
  platform: PlatformType;
  device_id?: string;  // Unique device identifier
  is_active: boolean;
  last_used_at: Date;
  created_at: Date;
  updated_at: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: PLATFORM_TYPES, required: true },
    device_id: { type: String, index: true },
    is_active: { type: Boolean, default: true },
    last_used_at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Compound index for efficient lookups
DeviceTokenSchema.index({ user_id: 1, platform: 1 });
DeviceTokenSchema.index({ user_id: 1, is_active: 1 });

export const DeviceToken = mongoose.model<IDeviceToken>("DeviceToken", DeviceTokenSchema, "device_tokens");
