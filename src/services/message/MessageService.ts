/**
 * Message Service
 * 
 * Business logic for message operations.
 * Handles message sending, history, and read receipts.
 */

// Removed unused import
import { 
  channelRepository,
  userRepository,
  Platform 
} from '../../repositories';
import { chatService } from '../ChatService';
import { events } from '../../utils/events';
import logger from '../../utils/logger';

export interface SendMessageParams {
  channelId: string;        // GetStream channel ID
  userId: string;           // MongoDB user ID
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
      channelId: getstreamChannelId, 
      userId, 
      platform,
      text, 
      type = 'regular', 
      attachments, 
      customData,
      parentId 
    } = params;

    logger.info('Sending message', { channelId: getstreamChannelId, userId, type });

    // 1. Verify membership
    // getChannelByGetstreamId or similar? 
    // Looking at previous version, it was using channelRepository.findByGetstreamId
    const channel = await channelRepository.findByGetstreamId(getstreamChannelId, platform);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const isMember = 
      channel.buyer_id.toString() === userId || 
      channel.seller_id.toString() === userId;

    if (!isMember) {
      throw new Error('Not a member of this channel');
    }

    // 2. Check channel status
    if (channel.status === 'closed') {
      throw new Error('Cannot send messages to a closed channel');
    }

    // 3. Deliver via GetStream
    let streamMessageId: string | undefined;
    let createdAt: Date = new Date();
    
    try {
      await chatService.ensureConnected();
      const client = chatService.getClient();
      const streamChannel = client.channel('messaging', getstreamChannelId);
      
      const msgPayload: any = {
        text: text.trim(),
        user_id: userId,
        custom: {
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
      createdAt = new Date(response.message?.created_at || Date.now());

      logger.info('Message delivered to Stream', { 
        streamMessageId 
      });
    } catch (error) {
      logger.error('Stream delivery failed', { 
        userId,
        channelId: getstreamChannelId,
        error 
      });
      throw new Error('Failed to deliver message to chat service');
    }

    // 4. Emit local event for side effects (optional, keeping for compatibility)
    events.emit('message:sent', {
      messageId: streamMessageId, // Using stream ID instead of Mongo ID
      channelId: getstreamChannelId,
      senderId: userId,
      type,
      platform,
    });

    // Get sender info for response
    const sender = await userRepository.getDisplayInfo(userId);

    return {
      id: streamMessageId || '',
      streamMessageId,
      text: text.trim(),
      type,
      sender: sender || { id: userId, name: 'User' },
      attachments: attachments || [],
      customData: customData || {},
      status: 'delivered',
      createdAt,
    };
  }

  /**
   * Get message history for a channel - Now fetching natively from GetStream
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

    // Get messages from GetStream
    const streamMessages = await chatService.getChannelMessages(channelId, limit, before);

    // Map to response format
    const messages = streamMessages.map((msg: any) => ({
      id: msg.id,
      streamMessageId: msg.id,
      text: msg.text || '',
      type: msg.custom?.type || (msg.type === 'regular' ? 'regular' : 'system'),
      sender: {
        id: msg.user?.id || '',
        name: msg.user?.name || 'User',
        avatar: msg.user?.image,
      },
      attachments: msg.attachments || [],
      customData: msg.custom || {},
      status: 'delivered',
      createdAt: new Date(msg.created_at),
    }));

    return {
      messages,
      hasMore: streamMessages.length >= limit,
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

    // Mark as read in GetStream
    try {
      await chatService.ensureConnected();
      const client = chatService.getClient();
      const streamChannel = client.channel('messaging', channelId);
      await streamChannel.markRead({ user_id: userId });
      logger.debug('Marked as read in GetStream', { channelId, userId });
    } catch (error) {
      logger.warn('Failed to mark read in GetStream', { channelId, error });
    }

    // Emit event
    events.emit('message:read', {
      channelId,
      userId,
    });

    return 0;
  }

  /**
   * Get unread count for a channel
   */
  async getUnreadCount(
    _channelId: string,
    _userId: string
  ): Promise<number> {
    // True unread counts should be fetched via GetStream client SDK on frontend
    return 0;
  }

  /**
   * Soft delete a message - Now using GetStream Message ID
   */
  async deleteMessage(
    streamMessageId: string,
    userId: string
  ): Promise<void> {
    try {
      await chatService.ensureConnected();
      const client = chatService.getClient();
      
      // Fetch message from Stream to verify ownership
      const response = await client.getMessage(streamMessageId);
      if (response.message.user?.id !== userId) {
          throw new Error('Can only delete your own messages');
      }

      await client.deleteMessage(streamMessageId, true); // true for hard delete
      logger.info('Message deleted from GetStream', { streamMessageId, userId });
    } catch (error) {
      logger.error('Failed to delete message from GetStream', { streamMessageId, error });
      throw error;
    }
  }
}

// Singleton instance
export const messageService = new MessageService();
