/**
 * ChatMessage Model
 * 
 * Stores all chat messages from GetStream for:
 * - Analytics and reporting
 * - Compliance and audit
 * - Business logic and moderation
 * - Message history backup
 */

import mongoose, { Document, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------

export interface IChatMessage extends Document {
  _id: Types.ObjectId;
  
  // GetStream IDs
  stream_message_id?: string;  // Optional - may not exist until GetStream confirms
  stream_channel_id: string;
  stream_channel_type: string;
  
  // Message content
  text: string;
  original_text?: string;  // Stored on first edit
  sender_id: Types.ObjectId;
  sender_clerk_id: string;
  
  // Message metadata
  type: "regular" | "system" | "offer" | "counter_offer" | "offer_accepted" | "offer_rejected" | "order_created" | "order_paid" | "order_shipped" | "order_delivered" | "inquiry" | "order" | "listing_reserved" | "offer_expired";
  attachments?: any[];
  mentioned_users?: string[];
  parent_id?: string; // For thread replies (GetStream)
  parent_message_id?: string; // For thread replies (MongoDB)
  custom_data?: Record<string, any>;  // Flexible custom data
  
  // Marketplace context
  listing_id?: Types.ObjectId;
  offer_id?: Types.ObjectId;
  order_id?: Types.ObjectId;
  
  // Delivery status (for backend control)
  status: "pending" | "sent" | "delivered" | "pending_delivery" | "failed" | "deleted";
  delivered_at?: Date;
  
  // Read receipts (backend tracking)
  read_by?: {
    user_id: Types.ObjectId;
    read_at: Date;
  }[];
  
  // Reactions (backend tracking)
  reactions?: {
    user_id: Types.ObjectId;
    type: string;
    created_at: Date;
  }[];
  
  // Edit tracking
  edited_at?: Date;
  
  // Deletion status
  is_deleted: boolean;
  deleted_at?: Date;
  updated_at_stream?: Date;
  
  // Moderation flags
  is_flagged: boolean;
  flag_reason?: string;
  moderated_by?: Types.ObjectId;
  
  // Source tracking
  source?: "backend" | "webhook" | "sdk";  // Track where message originated
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    stream_message_id: {
      type: String,
      required: false,  // Optional - set after GetStream confirms
      sparse: true,
      unique: true,
      index: true,
    },
    stream_channel_id: {
      type: String,
      required: true,
      index: true,
    },
    stream_channel_type: {
      type: String,
      required: true,
      default: "messaging",
    },
    text: {
      type: String,
      required: true,
    },
    sender_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender_clerk_id: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["regular", "system", "offer", "counter_offer", "offer_accepted", "offer_rejected", "order_created", "order_paid", "order_shipped", "order_delivered", "inquiry", "order", "listing_reserved", "offer_expired"],
      default: "regular",
      index: true,
    },
    attachments: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    mentioned_users: {
      type: [String],
      default: [],
    },
    parent_id: {
      type: String,
      default: null,
    },
    parent_message_id: {
      type: String,
      default: null,
    },
    original_text: {
      type: String,
      default: null,
    },
    custom_data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    // Delivery status for backend control
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "pending_delivery", "failed", "deleted"],
      default: "pending",
      index: true,
    },
    delivered_at: {
      type: Date,
      default: null,
    },
    // Read receipts
    read_by: [{
      user_id: { type: Schema.Types.ObjectId, ref: "User" },
      read_at: { type: Date },
    }],
    // Reactions
    reactions: [{
      user_id: { type: Schema.Types.ObjectId, ref: "User" },
      type: { type: String },
      created_at: { type: Date },
    }],
    edited_at: {
      type: Date,
      default: null,
    },
    source: {
      type: String,
      enum: ["backend", "webhook", "sdk"],
      default: "backend",
    },
    listing_id: {
      type: Schema.Types.ObjectId,
      ref: "MarketplaceListing",
      default: null,
      index: true,
    },
    offer_id: {
      type: Schema.Types.ObjectId,
      ref: "NetworkListingOffer",
      default: null,
      index: true,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deleted_at: {
      type: Date,
      default: null,
    },
    updated_at_stream: {
      type: Date,
      default: null,
    },
    is_flagged: {
      type: Boolean,
      default: false,
      index: true,
    },
    flag_reason: {
      type: String,
      default: null,
    },
    moderated_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for analytics and queries
ChatMessageSchema.index({ createdAt: -1 });
ChatMessageSchema.index({ sender_id: 1, createdAt: -1 });
ChatMessageSchema.index({ listing_id: 1, createdAt: -1 });
ChatMessageSchema.index({ stream_channel_id: 1, createdAt: -1 });

// Transform for JSON
ChatMessageSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.sender_id = ret.sender_id?.toString?.();
    ret.listing_id = ret.listing_id?.toString?.();
    ret.offer_id = ret.offer_id?.toString?.();
    ret.order_id = ret.order_id?.toString?.();
    return ret;
  },
});

// ----------------------------------------------------------
// Statics
// ----------------------------------------------------------

interface IChatMessageModel extends mongoose.Model<IChatMessage> {
  getMessagesByChannel(channelId: string, limit?: number): Promise<IChatMessage[]>;
  getMessagesByUser(userId: string, limit?: number): Promise<IChatMessage[]>;
  getMessagesByListing(listingId: string, limit?: number): Promise<IChatMessage[]>;
  flagMessage(messageId: string, reason: string, moderatorId: string): Promise<IChatMessage | null>;
}

ChatMessageSchema.statics.getMessagesByChannel = async function (
  channelId: string,
  limit: number = 100
): Promise<IChatMessage[]> {
  return this.find({ stream_channel_id: channelId, is_deleted: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender_id", "display_name avatar");
};

ChatMessageSchema.statics.getMessagesByUser = async function (
  userId: string,
  limit: number = 100
): Promise<IChatMessage[]> {
  return this.find({ sender_id: userId, is_deleted: false })
    .sort({ createdAt: -1 })
    .limit(limit);
};

ChatMessageSchema.statics.getMessagesByListing = async function (
  listingId: string,
  limit: number = 100
): Promise<IChatMessage[]> {
  return this.find({ listing_id: listingId, is_deleted: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender_id", "display_name avatar");
};

ChatMessageSchema.statics.flagMessage = async function (
  messageId: string,
  reason: string,
  moderatorId: string
): Promise<IChatMessage | null> {
  return this.findOneAndUpdate(
    { stream_message_id: messageId },
    {
      is_flagged: true,
      flag_reason: reason,
      moderated_by: moderatorId,
    },
    { new: true }
  );
};

export const ChatMessage = mongoose.model<IChatMessage, IChatMessageModel>(
  "ChatMessage",
  ChatMessageSchema,
  "chat_messages"
);

export default ChatMessage;
