import { messageService, SendMessageParams, GetMessagesParams, MessageResponse } from '../../shared/services/message/MessageService';

/**
 * Networks Message Service (Façade)
 * 
 * Locked to 'networks' platform.
 */
export class NetworksMessageService {
  /**
   * Send a networks message
   */
  async sendMessage(params: Omit<SendMessageParams, 'platform'>): Promise<MessageResponse> {
    return messageService.sendMessage({
      ...params,
      platform: 'networks'
    });
  }

  /**
   * Get networks message history
   */
  async getMessages(params: Omit<GetMessagesParams, 'platform'>): Promise<{
    messages: MessageResponse[];
    hasMore: boolean;
  }> {
    return messageService.getMessages({
      ...params,
      platform: 'networks'
    });
  }

  /**
   * Mark networks messages as read
   */
  async markAsRead(channelId: string, userId: string): Promise<number> {
    return messageService.markAsRead(channelId, userId, 'networks');
  }

  /**
   * Delete a networks message
   */
  async deleteMessage(streamMessageId: string, userId: string): Promise<void> {
    return messageService.deleteMessage(streamMessageId, userId);
  }
}

export const networksMessageService = new NetworksMessageService();
