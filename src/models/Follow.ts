/**
 * Follow Model
 *
 * Tracks follow relationships between users.
 * Syncs with GetStream Activity Feeds for real-time updates.
 */

import mongoose, { Document, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------

export const FOLLOW_STATUS_VALUES = ["pending", "accepted"] as const;
export type FollowStatus = (typeof FOLLOW_STATUS_VALUES)[number];

export interface IFollow extends Document {
  _id: Types.ObjectId;
  follower_id: Types.ObjectId; // User who is following
  following_id: Types.ObjectId; // User being followed
  status: FollowStatus;
  accepted_at?: Date | null;
  createdAt: Date;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------

const followSchema = new Schema<IFollow>(
  {
    follower_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    following_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: FOLLOW_STATUS_VALUES,
      default: "pending",
      index: true,
    },
    accepted_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Unique compound index to prevent duplicate follows
followSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });

// Transform _id to string in JSON responses
followSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.follower_id = ret.follower_id?.toString?.();
    ret.following_id = ret.following_id?.toString?.();
    return ret;
  },
});

// ----------------------------------------------------------
// Statics
// ----------------------------------------------------------

interface IFollowModel extends mongoose.Model<IFollow> {
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  getFollowersCount(userId: string): Promise<number>;
  getFollowingCount(userId: string): Promise<number>;
  getFollowStatus(
    followerId: string,
    followingId: string,
  ): Promise<IFollow | null>;
}

followSchema.statics.isFollowing = async function (
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const follow = await this.findOne({
    follower_id: followerId,
    following_id: followingId,
    status: "accepted",
  });
  return !!follow;
};

followSchema.statics.getFollowersCount = async function (
  userId: string,
): Promise<number> {
  return this.countDocuments({ following_id: userId, status: "accepted" });
};

followSchema.statics.getFollowingCount = async function (
  userId: string,
): Promise<number> {
  return this.countDocuments({ follower_id: userId, status: "accepted" });
};

followSchema.statics.getFollowStatus = async function (
  followerId: string,
  followingId: string,
): Promise<IFollow | null> {
  return this.findOne({
    follower_id: followerId,
    following_id: followingId,
  });
};

export const Follow = mongoose.model<IFollow, IFollowModel>(
  "Follow",
  followSchema,
  "follows",
);

export default Follow;
