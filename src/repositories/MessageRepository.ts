/**
 * Message Repository
 * 
 * Data access layer for chat messages stored in MongoDB.
 * Messages are persisted via GetStream webhooks for analytics and history.
 */

import { Types } from 'mongoose';
import { BaseRepository, QueryOptions } from './base/BaseRepository';
import { ChatMessage, IChatMessage } from '../models/ChatMessage';

export interface FindMessagesParams {
  channelId: string;
  limit?: number;
  before?: string; // ISO date string for cursor pagination
  type?: string;
}

export interface CreateMessageParams {
  streamChannelId: string;
  streamMessageId?: string;
  text: string;
  senderId: string;
  senderClerkId: string;
  type?: string;
  listingId?: string;
  attachments?: any[];
  customData?: Record<string, any>;
  parentMessageId?: string;
}

class MessageRepositoryClass extends BaseRepository<IChatMessage> {
  constructor() {
    super(ChatMessage);
  }

  /**
   * Find messages for a channel with cursor pagination
   */
  async findByChannel(params: FindMessagesParams): Promise<{
    messages: IChatMessage[];
    hasMore: boolean;
  }> {
    const { channelId, limit = 50, before, type } = params;
    const cappedLimit = Math.min(limit, 100);

    const filter: any = { stream_channel_id: channelId };
    
    if (before) {
      filter.createdAt = { $lt: new Date(before) };
    }
    
    if (type) {
      filter.type = type;
    }

    const messages = await this.find(filter, {
      sort: { createdAt: -1 },
      limit: cappedLimit + 1, // Fetch one extra to check hasMore
      populate: 'sender_id',
    });

    const hasMore = messages.length > cappedLimit;
    if (hasMore) {
      messages.pop(); // Remove the extra item
    }

    return {
      messages: messages.reverse(), // Chronological order
      hasMore,
    };
  }

  /**
   * Find messages by listing
   */
  async findByListing(
    listingId: string, 
    options?: QueryOptions
  ): Promise<IChatMessage[]> {
    return this.find(
      { listing_id: new Types.ObjectId(listingId) },
      { 
        sort: { createdAt: -1 },
        limit: options?.limit || 100,
        populate: 'sender_id',
        ...options,
      }
    );
  }

  /**
   * Find messages by user
   */
  async findByUser(
    userId: string, 
    options?: QueryOptions
  ): Promise<IChatMessage[]> {
    return this.find(
      { sender_id: new Types.ObjectId(userId) },
      {
        sort: { createdAt: -1 },
        limit: options?.limit || 100,
        ...options,
      }
    );
  }

  /**
   * Find by GetStream message ID
   */
  async findByStreamId(streamMessageId: string): Promise<IChatMessage | null> {
    return this.findOne({ stream_message_id: streamMessageId });
  }

  /**
   * Create a new message
   */
  async createMessage(params: CreateMessageParams): Promise<IChatMessage> {
    return this.create({
      stream_channel_id: params.streamChannelId,
      stream_message_id: params.streamMessageId,
      text: params.text,
      sender_id: new Types.ObjectId(params.senderId),
      sender_clerk_id: params.senderClerkId,
      type: params.type || 'regular',
      listing_id: params.listingId ? new Types.ObjectId(params.listingId) : undefined,
      attachments: params.attachments || [],
      custom_data: params.customData || {},
      parent_message_id: params.parentMessageId 
        ? new Types.ObjectId(params.parentMessageId) 
        : undefined,
      status: 'sent',
    } as any);
  }

  /**
   * Update message status
   */
  async updateStatus(
    messageId: string, 
    status: 'sent' | 'delivered' | 'pending_delivery' | 'failed' | 'deleted'
  ): Promise<IChatMessage | null> {
    return this.updateById(messageId, { status } as any);
  }

  /**
   * Update with Stream message ID after delivery
   */
  async updateStreamId(
    messageId: string, 
    streamMessageId: string
  ): Promise<IChatMessage | null> {
    return this.updateById(messageId, { 
      stream_message_id: streamMessageId,
      status: 'delivered',
    } as any);
  }

  /**
   * Mark messages as read by user
   */
  async markAsReadByUser(channelId: string, userId: string): Promise<number> {
    const userObjectId = new Types.ObjectId(userId);
    return this.updateMany(
      {
        stream_channel_id: channelId,
        sender_id: { $ne: userObjectId },
        'read_by.user_id': { $ne: userObjectId },
      },
      { 
        $push: { 
          read_by: { 
            user_id: userObjectId, 
            read_at: new Date() 
          } 
        } 
      } as any
    );
  }

  /**
   * Soft delete a message
   */
  async softDelete(messageId: string): Promise<IChatMessage | null> {
    return this.updateById(messageId, { 
      status: 'deleted',
      text: '[Message deleted]',
    } as any);
  }

  /**
   * Flag a message for moderation
   */
  async flagMessage(
    messageId: string, 
    reason: string, 
    flaggedBy: string
  ): Promise<IChatMessage | null> {
    return this.updateById(messageId, {
      is_flagged: true,
      flagged_reason: reason,
      flagged_by: new Types.ObjectId(flaggedBy),
      flagged_at: new Date(),
    } as any);
  }

  /**
   * Get message statistics for analytics
   */
  async getStatsByChannel(channelId: string): Promise<{
    total: number;
    byType: { type: string; count: number }[];
  }> {
    const total = await this.count({ stream_channel_id: channelId });
    
    const byType = await ChatMessage.aggregate([
      { $match: { stream_channel_id: channelId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $project: { type: '$_id', count: 1, _id: 0 } },
    ]);

    return { total, byType };
  }

  /**
   * Get unread count for user in a channel
   */
  async getUnreadCount(channelId: string, userId: string): Promise<number> {
    const userObjectId = new Types.ObjectId(userId);
    return this.count({
      stream_channel_id: channelId,
      sender_id: { $ne: userObjectId },
      'read_by.user_id': { $ne: userObjectId },
    });
  }
}

// Singleton instance
export const messageRepository = new MessageRepositoryClass();
export { MessageRepositoryClass as MessageRepository };
