/**
 * Connection Model
 *
 * Tracks connection requests and accepted connections between users.
 * NOTE: Field names keep legacy direction semantics to avoid document rewrites
 * during collection migration.
 */

import mongoose, { Document, Schema, Types } from "mongoose";

export const CONNECTION_STATUS_VALUES = ["pending", "accepted"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUS_VALUES)[number];

export interface IConnection extends Document {
  _id: Types.ObjectId;
  follower_id: Types.ObjectId; // request sender
  following_id: Types.ObjectId; // request target
  status: ConnectionStatus;
  accepted_at?: Date | null;
  createdAt: Date;
}

const connectionSchema = new Schema<IConnection>(
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
      enum: CONNECTION_STATUS_VALUES,
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

// Prevent duplicate directional requests.
connectionSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });

connectionSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.follower_id = ret.follower_id?.toString?.();
    ret.following_id = ret.following_id?.toString?.();
    return ret;
  },
});

interface IConnectionModel extends mongoose.Model<IConnection> {
  isConnected(followerId: string, followingId: string): Promise<boolean>;
  getIncomingCount(userId: string): Promise<number>;
  getOutgoingCount(userId: string): Promise<number>;
  getConnectionStatus(
    followerId: string,
    followingId: string,
  ): Promise<IConnection | null>;
}

connectionSchema.statics.isConnected = async function (
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const connection = await this.findOne({
    follower_id: followerId,
    following_id: followingId,
    status: "accepted",
  });
  return !!connection;
};

connectionSchema.statics.getIncomingCount = async function (
  userId: string,
): Promise<number> {
  return this.countDocuments({ following_id: userId, status: "accepted" });
};

connectionSchema.statics.getOutgoingCount = async function (
  userId: string,
): Promise<number> {
  return this.countDocuments({ follower_id: userId, status: "accepted" });
};

connectionSchema.statics.getConnectionStatus = async function (
  followerId: string,
  followingId: string,
): Promise<IConnection | null> {
  return this.findOne({
    follower_id: followerId,
    following_id: followingId,
  });
};

export const Connection = mongoose.model<IConnection, IConnectionModel>(
  "Connection",
  connectionSchema,
  "connections",
);

export default Connection;
