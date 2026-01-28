/**
 * Friendship Model (Gap Fill Phase 4)
 * 
 * Two-way friend relationships (distinct from one-way Follow)
 * Friends have mutual relationship, follows are unidirectional
 * 
 * Flow:
 * 1. User A sends friend request → status="pending"
 * 2. User B accepts → status="accepted", both users' friend_count updates
 * 3. Either user can terminate → status="declined" or friendship deleted
 */

import mongoose, { Document, Schema, Types, Model } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------

export const FRIENDSHIP_STATUS_VALUES = [
  "pending",    // Request sent, awaiting response
  "accepted",   // Both users are friends
  "declined",   // Request was declined
] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUS_VALUES)[number];

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------

export interface IFriendship extends Document {
  _id: Types.ObjectId;
  
  // The user who initiated the friend request
  requester_id: Types.ObjectId;
  
  // The user who received the request
  addressee_id: Types.ObjectId;
  
  // Current status
  status: FriendshipStatus;
  
  // When status changed to "accepted" (null if pending/declined)
  accepted_at?: Date | null;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IFriendshipModel extends Model<IFriendship> {
  /**
   * Check if two users are friends
   */
  areFriends(userIdA: string | Types.ObjectId, userIdB: string | Types.ObjectId): Promise<boolean>;
  
  /**
   * Get pending friend requests for a user
   */
  getPendingRequests(userId: string | Types.ObjectId): Promise<IFriendship[]>;
  
  /**
   * Get count of accepted friends for a user
   */
  getFriendCount(userId: string | Types.ObjectId): Promise<number>;
  
  /**
   * Get mutual friends between two users
   */
  getMutualFriends(userIdA: string | Types.ObjectId, userIdB: string | Types.ObjectId): Promise<Types.ObjectId[]>;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------

const FriendshipSchema = new Schema<IFriendship>(
  {
    requester_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    addressee_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: FRIENDSHIP_STATUS_VALUES,
      default: "pending",
      index: true,
    },
    accepted_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ----------------------------------------------------------
// Indexes
// ----------------------------------------------------------

// Prevent duplicate friend requests (either direction)
// This compound index allows queries for friendship in either direction
FriendshipSchema.index({ requester_id: 1, addressee_id: 1 }, { unique: true });

// For querying a user's friends (both directions)
FriendshipSchema.index({ requester_id: 1, status: 1 });
FriendshipSchema.index({ addressee_id: 1, status: 1 });

// ----------------------------------------------------------
// Static Methods
// ----------------------------------------------------------

/**
 * Check if two users are friends (accepted status in either direction)
 */
FriendshipSchema.statics.areFriends = async function(
  userIdA: string | Types.ObjectId,
  userIdB: string | Types.ObjectId
): Promise<boolean> {
  const objIdA = typeof userIdA === "string" ? new Types.ObjectId(userIdA) : userIdA;
  const objIdB = typeof userIdB === "string" ? new Types.ObjectId(userIdB) : userIdB;
  
  const friendship = await this.findOne({
    $or: [
      { requester_id: objIdA, addressee_id: objIdB, status: "accepted" },
      { requester_id: objIdB, addressee_id: objIdA, status: "accepted" },
    ],
  }).lean();
  
  return !!friendship;
};

/**
 * Get pending friend requests received by a user
 */
FriendshipSchema.statics.getPendingRequests = async function(
  userId: string | Types.ObjectId
): Promise<IFriendship[]> {
  const objId = typeof userId === "string" ? new Types.ObjectId(userId) : userId;
  
  return this.find({
    addressee_id: objId,
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .populate("requester_id", "display_name avatar")
    .lean();
};

/**
 * Get count of accepted friends for a user
 */
FriendshipSchema.statics.getFriendCount = async function(
  userId: string | Types.ObjectId
): Promise<number> {
  const objId = typeof userId === "string" ? new Types.ObjectId(userId) : userId;
  
  return this.countDocuments({
    $or: [
      { requester_id: objId, status: "accepted" },
      { addressee_id: objId, status: "accepted" },
    ],
  });
};

/**
 * Get IDs of users who are friends with both User A and User B
 */
FriendshipSchema.statics.getMutualFriends = async function(
  userIdA: string | Types.ObjectId,
  userIdB: string | Types.ObjectId
): Promise<Types.ObjectId[]> {
  const objIdA = typeof userIdA === "string" ? new Types.ObjectId(userIdA) : userIdA;
  const objIdB = typeof userIdB === "string" ? new Types.ObjectId(userIdB) : userIdB;

  // Find all friends of User A
  const friendsA = await this.find({
    $or: [{ requester_id: objIdA }, { addressee_id: objIdA }],
    status: "accepted",
  }).lean();

  const friendIdsA = friendsA.map((f: IFriendship) =>
    f.requester_id.toString() === objIdA.toString() ? f.addressee_id : f.requester_id
  );

  // Find all friends of User B
  const friendsB = await this.find({
    $or: [{ requester_id: objIdB }, { addressee_id: objIdB }],
    status: "accepted",
  }).lean();

  const friendIdsB = new Set(
    friendsB.map((f: IFriendship) =>
      f.requester_id.toString() === objIdB.toString() ? f.addressee_id.toString() : f.requester_id.toString()
    )
  );

  // Find intersection
  return friendIdsA.filter((id: Types.ObjectId) => friendIdsB.has(id.toString()));
};

// ----------------------------------------------------------
// Transform
// ----------------------------------------------------------

FriendshipSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.requester_id = ret.requester_id?.toString?.();
    ret.addressee_id = ret.addressee_id?.toString?.();
    return ret;
  },
});

// ----------------------------------------------------------
// Export
// ----------------------------------------------------------

export const Friendship = mongoose.model<IFriendship, IFriendshipModel>(
  "Friendship",
  FriendshipSchema,
  "friendships"
);
