/**
 * Message Service
 * 
 * Business logic for message operations.
 * Handles message sending, history, and read receipts.
 */

// Removed unused import
import { 
  messageRepository, 
  channelRepository,
  userRepository,
  Platform 
} from '../../repositories';
import { chatService } from '../ChatService';
import { events } from '../../utils/events';
import logger from '../../utils/logger';

export interface SendMessageParams {
  channelId: string;        // MongoDB channel ID
  getstreamChannelId: string;
  userId: string;
  clerkId: string;
  platform: Platform;
  text: string;
  type?: string;
  attachments?: any[];
  customData?: Record<string, any>;
  parentId?: string;
}

export interface GetMessagesParams {
  channelId: string;        // GetStream channel ID
  userId: string;
  platform: Platform;
  limit?: number;
  before?: string;          // ISO date for cursor pagination
}

export interface MessageResponse {
  id: string;
  streamMessageId?: string;
  text: string;
  type: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  attachments: any[];
  customData: Record<string, any>;
  status: string;
  createdAt: Date;
}

export class MessageService {
  /**
   * Send a message through backend
   * 
   * Flow:
   * 1. Verify channel membership
   * 2. Check channel status (not closed)
   * 3. Store in MongoDB
   * 4. Deliver via GetStream
   * 5. Update with Stream message ID
   * 6. Emit event for side effects
   */
  async sendMessage(params: SendMessageParams): Promise<MessageResponse> {
    const { 
      channelId, 
      getstreamChannelId, 
      userId, 
      clerkId, 
      platform,
      text, 
      type = 'regular', 
      attachments, 
      customData,
      parentId 
    } = params;

    logger.info('Sending message', { channelId, userId, type });

    // 1. Verify membership
    const isMember = await channelRepository.isMember(channelId, userId, platform);
    if (!isMember) {
      throw new Error('Not a member of this channel');
    }

    // 2. Check channel status
    const channel = await channelRepository.findById(channelId, platform);
    if (!channel) {
      throw new Error('Channel not found');
    }
    if (channel.status === 'closed') {
      throw new Error('Cannot send messages to a closed channel');
    }

    // 3. Store in MongoDB
    const dbMessage = await messageRepository.createMessage({
      streamChannelId: getstreamChannelId,
      text: text.trim(),
      senderId: userId,
      senderClerkId: clerkId,
      type,
      listingId: channel.listing_id.toString(),
      attachments: attachments || [],
      customData: { ...customData, platform },
      ...(parentId ? { parentMessageId: parentId } : {}),
    });

    // 4. Deliver via GetStream
    let streamMessageId: string | undefined;
    try {
      await chatService.ensureConnected();
      const client = chatService.getClient();
      const streamChannel = client.channel('messaging', getstreamChannelId);
      
      const msgPayload: any = {
        text: text.trim(),
        user_id: userId,
        custom: {
          mongo_id: dbMessage._id.toString(),
          type,
          platform,
          ...(customData || {}),
        },
      };

      if (attachments?.length) {
        msgPayload.attachments = attachments;
      }
      if (parentId) {
        msgPayload.parent_id = parentId;
      }

      const response = await streamChannel.sendMessage(msgPayload);
      streamMessageId = response.message?.id;

      // 5. Update with Stream message ID
      await messageRepository.updateStreamId(
        dbMessage._id.toString(), 
        streamMessageId!
      );

      logger.info('Message delivered', { 
        messageId: dbMessage._id, 
        streamMessageId 
      });
    } catch (error) {
      // Stream delivery failed - message is stored as pending
      logger.warn('Stream delivery failed', { 
        messageId: dbMessage._id, 
        error 
      });
      await messageRepository.updateStatus(
        dbMessage._id.toString(), 
        'pending_delivery'
      );
    }

    // 6. Emit event
    events.emit('message:sent', {
      messageId: dbMessage._id.toString(),
      channelId: getstreamChannelId,
      senderId: userId,
      type,
      platform,
    });

    // Get sender info for response
    const sender = await userRepository.getDisplayInfo(userId);

    return {
      id: dbMessage._id.toString(),
      ...(streamMessageId ? { streamMessageId } : {}),
      text: text.trim(),
      type,
      sender: sender || { id: userId, name: 'User' },
      attachments: attachments || [],
      customData: customData || {},
      status: streamMessageId ? 'delivered' : 'pending_delivery',
      createdAt: dbMessage.createdAt,
    };
  }

  /**
   * Get message history for a channel
   */
  async getMessages(params: GetMessagesParams): Promise<{
    messages: MessageResponse[];
    hasMore: boolean;
  }> {
    const { channelId, userId, platform, limit = 50, before } = params;

    // Verify membership via GetStream channel ID
    const channel = await channelRepository.findByGetstreamId(channelId, platform);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const isMember = 
      channel.buyer_id.toString() === userId ||
      channel.seller_id.toString() === userId;
    
    if (!isMember) {
      throw new Error('Not a member of this channel');
    }

    // Get messages from MongoDB
    const { messages, hasMore } = await messageRepository.findByChannel({
      channelId,
      limit,
      ...(before ? { before } : {}),
    });

    // Map to response format
    return {
      messages: messages.map((msg: any) => ({
        id: msg._id.toString(),
        ...(msg.stream_message_id ? { streamMessageId: msg.stream_message_id } : {}),
        text: msg.text,
        type: msg.type,
        sender: {
          id: msg.sender_id?._id?.toString() || msg.sender_id?.toString() || '',
          name: msg.sender_id?.display_name || msg.sender_id?.first_name || 'User',
          ...(msg.sender_id?.avatar ? { avatar: msg.sender_id.avatar } : {}),
        },
        attachments: msg.attachments || [],
        customData: msg.custom_data || {},
        status: msg.status,
        createdAt: msg.createdAt,
      })),
      hasMore,
    };
  }

  /**
   * Mark messages as read in a channel
   */
  async markAsRead(
    channelId: string, // GetStream channel ID
    userId: string,
    platform: Platform
  ): Promise<number> {
    // Verify membership
    const channel = await channelRepository.findByGetstreamId(channelId, platform);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const isMember = 
      channel.buyer_id.toString() === userId ||
      channel.seller_id.toString() === userId;
    
    if (!isMember) {
      throw new Error('Not a member of this channel');
    }

    // Mark as read in MongoDB
    const count = await messageRepository.markAsReadByUser(channelId, userId);

    // Also mark as read in GetStream
    try {
      await chatService.ensureConnected();
      const client = chatService.getClient();
      const streamChannel = client.channel('messaging', channelId);
      await streamChannel.markRead({ user_id: userId });
    } catch (error) {
      logger.warn('Failed to mark read in GetStream', { channelId, error });
    }

    // Emit event
    events.emit('message:read', {
      channelId,
      userId,
      messageCount: count,
    });

    return count;
  }

  /**
   * Get unread count for a channel
   */
  async getUnreadCount(
    channelId: string,
    userId: string
  ): Promise<number> {
    return messageRepository.getUnreadCount(channelId, userId);
  }

  /**
   * Soft delete a message
   */
  async deleteMessage(
    messageId: string,
    userId: string
  ): Promise<void> {
    const message = await messageRepository.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Only sender can delete
    if (message.sender_id.toString() !== userId) {
      throw new Error('Can only delete your own messages');
    }

    // Soft delete in MongoDB
    await messageRepository.softDelete(messageId);

    // Delete from GetStream if we have the ID
    if (message.stream_message_id) {
      try {
        await chatService.ensureConnected();
        const client = chatService.getClient();
        await client.deleteMessage(message.stream_message_id);
      } catch (error) {
        logger.warn('Failed to delete message from GetStream', { messageId, error });
      }
    }

    logger.info('Message deleted', { messageId, userId });
  }
}

// Singleton instance
export const messageService = new MessageService();
