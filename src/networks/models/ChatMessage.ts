/**
 * Chat Message Model - Networks Module
 *
 * Stores complete message archive for:
 * - Full-text search across conversations
 * - Message analytics and reporting
 * - Dispute resolution (who said what, when)
 * - Export/backup of conversation history
 * - Read receipt tracking (Phase 3)
 *
 * Note: GetStream Cloud stores messages in their system.
 * This model is our LOCAL ARCHIVE for compliance and features
 * that require offline search/analytics.
 *
 * Indexes optimized for:
 * - Query by channel_id + created_at (fetch history)
 * - Query by sender_id + created_at (user's messages)
 * - Full-text search on text field
 */

import mongoose, { Model, Schema, Types } from "mongoose";

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * IChatMessage - Networks message document structure
 */
export interface IChatMessage {
  _id?: Types.ObjectId;
  channel_id: string; // GetStream channel ID
  getstream_message_id: string; // GetStream message ID (immutable)
  sender_id: Types.ObjectId; // User who sent message
  sender_clerk_id: string; // Clerk user ID of sender
  text: string; // Message text
  html?: string; // HTML rendered version
  attachments: Array<{
    type: string;
    asset_url: string;
    thumb_url?: string;
  }>;
  mentioned_users: Types.ObjectId[]; // @mentioned users
  reactions: Record<string, Array<{ user_id: string; timestamp: Date }>>;
  read_by: Array<{ user_id: string; read_at: Date }>;
  pinned: boolean;
  pinned_at?: Date;
  thread_id?: string; // Parent thread ID (Phase 3)
  parent_message_id?: string; // Reply to message (Phase 3)
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date; // Soft delete timestamp
  is_deleted?: boolean; // Deleted flag
  custom?: Record<string, any>; // Custom fields from GetStream
  custom_data?: Record<string, any>; // Additional custom metadata
  status?: "pending_delivery" | "delivered" | "failed"; // Delivery status
  original_text?: string; // Original text before edits
  edited_at?: Date; // When message was last edited
  type?: string; // Message type classifier
  stream_message_id?: string; // Alias for getstream_message_id (for convenience)
  stream_channel_id?: string; // Alias for channel_id (for convenience)
}

/**
 * IChatMessageModel - Static methods on model
 */
interface IChatMessageModel extends Model<IChatMessage> {
  findByChannelId(
    channelId: string,
    limit?: number,
    skip?: number,
  ): Promise<IChatMessage[]>;
  findBySenderId(
    senderId: string,
    limit?: number,
    skip?: number,
  ): Promise<IChatMessage[]>;
  getMessagesByListing(
    listingId: string,
    limit?: number,
  ): Promise<IChatMessage[]>;
  markAsDeleted(messageId: string): Promise<IChatMessage | null>;
  getReadBy(
    messageId: string,
  ): Promise<Array<{ user_id: string; read_at: Date }>>;
}

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

const ChatMessageSchema = new Schema<IChatMessage, IChatMessageModel>(
  {
    channel_id: {
      type: String,
      required: true,
      index: true, // For querying by channel
      description: "GetStream channel ID (e.g., networks-listing-{listingId})",
    },
    getstream_message_id: {
      type: String,
      required: true,
      unique: true, // Prevent duplicates from retried webhooks
      index: true,
      description: "GetStream message ID - immutable identifier",
    },
    sender_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // For user's message history
      description: "User who sent the message",
    },
    sender_clerk_id: {
      type: String,
      required: true,
      index: true,
      description: "Clerk user ID of message sender - for auth validation",
    },
    text: {
      type: String,
      required: true,
      description: "Message text content",
    },
    html: {
      type: String,
      description: "Rendered HTML version (if formatted text used)",
    },
    attachments: [
      {
        type: String, // 'image', 'file', 'video', etc.
        asset_url: String,
        thumb_url: String,
      },
    ],
    mentioned_users: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        description: "@mentioned user IDs",
      },
    ],
    reactions: {
      type: Map,
      of: [
        {
          user_id: String,
          timestamp: Date,
        },
      ],
      description:
        "Emoji reactions: { '👍': [{user_id, timestamp}, ...], ... }",
    },
    read_by: [
      {
        user_id: String,
        read_at: Date,
      },
    ],
    pinned: {
      type: Boolean,
      default: false,
      description: "Whether message is pinned to top of channel",
    },
    pinned_at: {
      type: Date,
      description: "When message was pinned",
    },
    thread_id: {
      type: String,
      description: "Parent thread ID for threaded replies (Phase 3)",
    },
    parent_message_id: {
      type: String,
      description: "Message ID this is replying to (Phase 3)",
    },
    created_at: {
      type: Date,
      required: true,
      index: true, // For sorting by date
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    deleted_at: {
      type: Date,
      description: "Soft delete: message marked as deleted but preserved",
    },
    is_deleted: {
      type: Boolean,
      default: false,
      description: "Flag indicating if message is deleted",
    },
    custom: {
      type: Schema.Types.Mixed,
      description: "Custom fields from GetStream webhook",
    },
    custom_data: {
      type: Schema.Types.Mixed,
      description: "Additional custom metadata for handlers",
    },
    status: {
      type: String,
      enum: ["pending_delivery", "delivered", "failed"],
      default: "pending_delivery",
      description: "Message delivery status",
    },
    original_text: {
      type: String,
      description: "Original text content before edits",
    },
    edited_at: {
      type: Date,
      description: "Timestamp when message was last edited",
    },
    type: {
      type: String,
      description: "Message type classifier (e.g., listing_message)",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "chat_messages",
    virtuals: true,
    toJSON: { virtuals: true },
  },
);

// ============================================================================
// INDEXES
// ============================================================================

// Query messages in a conversation (sorted newest first)
ChatMessageSchema.index({ channel_id: 1, created_at: -1 });

// Query user's messages across all conversations
ChatMessageSchema.index({ sender_id: 1, created_at: -1 });

// Full-text search on message content
ChatMessageSchema.index({ text: "text" });

// Query read receipts
ChatMessageSchema.index({ "read_by.user_id": 1 });

// ============================================================================
// STATIC METHODS
// ============================================================================

/**
 * Find all messages in a channel
 */
ChatMessageSchema.static(
  "findByChannelId",
  async function findByChannelId(
    channelId: string,
    limit = 50,
    skip = 0,
  ): Promise<IChatMessage[]> {
    return this.find({ channel_id: channelId, deleted_at: null })
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
  },
);

/**
 * Find all messages in a channel by listing ID
 */
ChatMessageSchema.static(
  "getMessagesByListing",
  async function getMessagesByListing(
    listingId: string,
    limit = 50,
  ): Promise<IChatMessage[]> {
    // ListingId is typically part of the channel_id (e.g., networks-listing-{listingId})
    const channelPattern = `networks-listing-${listingId}`;
    return this.find({
      channel_id: { $regex: channelPattern },
      deleted_at: null,
    })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
  },
);

/**
 * Find all messages sent by a user
 */
ChatMessageSchema.static(
  "findBySenderId",
  async function findBySenderId(
    senderId: string,
    limit = 50,
    skip = 0,
  ): Promise<IChatMessage[]> {
    return this.find({ sender_id: senderId, deleted_at: null })
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
  },
);

/**
 * Mark message as deleted (soft delete)
 */
ChatMessageSchema.static(
  "markAsDeleted",
  async function markAsDeleted(messageId: string) {
    return this.findOneAndUpdate(
      { getstream_message_id: messageId },
      {
        $set: {
          deleted_at: new Date(),
          text: "[deleted]",
        },
      },
      { new: true },
    );
  },
);

/**
 * Get read receipts for a message (who read it)
 */
ChatMessageSchema.static(
  "getReadBy",
  async function getReadBy(messageId: string) {
    const msg = await this.findOne(
      { getstream_message_id: messageId },
      { read_by: 1 },
    );
    return msg?.read_by || [];
  },
);

// ============================================================================
// VIRTUAL PROPERTIES (Aliases for naming convention compatibility)
// ============================================================================

/**
 * Virtual getter/setter for stream_message_id (alias for getstream_message_id)
 */
ChatMessageSchema.virtual("stream_message_id")
  .get(function () {
    return this.getstream_message_id;
  })
  .set(function (value: string) {
    this.getstream_message_id = value;
  });

/**
 * Virtual getter/setter for stream_channel_id (alias for channel_id)
 */
ChatMessageSchema.virtual("stream_channel_id")
  .get(function () {
    return this.channel_id;
  })
  .set(function (value: string) {
    this.channel_id = value;
  });

/**
 * Virtual getter for createdAt (camelCase alias for created_at)
 */
ChatMessageSchema.virtual("createdAt")
  .get(function () {
    return this.created_at;
  })
  .set(function (value: Date) {
    this.created_at = value;
  });

/**
 * Virtual getter for updatedAt (camelCase alias for updated_at)
 */
ChatMessageSchema.virtual("updatedAt")
  .get(function () {
    return this.updated_at;
  })
  .set(function (value: Date) {
    this.updated_at = value;
  });

// ============================================================================
// INSTANCE METHODS (Future use)
// ============================================================================

/**
 * Mark this message as read by a user
 */
ChatMessageSchema.methods.markAsReadBy = async function (userId: string) {
  // Add to read_by if not already there
  const exists = this.read_by?.some((r: any) => r.user_id === userId);
  if (!exists) {
    this.read_by.push({
      user_id: userId,
      read_at: new Date(),
    });
    await this.save();
  }
};

/**
 * Add reaction to message
 */
ChatMessageSchema.methods.addReaction = async function (
  reactionType: string,
  userId: string,
) {
  if (!this.reactions) {
    this.reactions = new Map();
  }

  if (!this.reactions.get(reactionType)) {
    this.reactions.set(reactionType, []);
  }

  // Avoid duplicates
  const existing = this.reactions
    .get(reactionType)
    ?.some((r: any) => r.user_id === userId);

  if (!existing) {
    this.reactions.get(reactionType)?.push({
      user_id: userId,
      timestamp: new Date(),
    });
    await this.save();
  }
};

// ============================================================================
// MODEL EXPORT
// ============================================================================

export const ChatMessage = mongoose.model<IChatMessage, IChatMessageModel>(
  "ChatMessage",
  ChatMessageSchema,
);
