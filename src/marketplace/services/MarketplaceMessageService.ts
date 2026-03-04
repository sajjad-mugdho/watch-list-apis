import { messageService, SendMessageParams, GetMessagesParams, MessageResponse } from '../../shared/services/message/MessageService';

/**
 * Marketplace Message Service (Façade)
 * 
 * Locked to 'marketplace' platform.
 */
export class MarketplaceMessageService {
  /**
   * Send a marketplace message
   */
  async sendMessage(params: Omit<SendMessageParams, 'platform'>): Promise<MessageResponse> {
    return messageService.sendMessage({
      ...params,
      platform: 'marketplace'
    });
  }

  /**
   * Get marketplace message history
   */
  async getMessages(params: Omit<GetMessagesParams, 'platform'>): Promise<{
    messages: MessageResponse[];
    hasMore: boolean;
  }> {
    return messageService.getMessages({
      ...params,
      platform: 'marketplace'
    });
  }

  /**
   * Mark marketplace messages as read
   */
  async markAsRead(channelId: string, userId: string): Promise<number> {
    return messageService.markAsRead(channelId, userId, 'marketplace');
  }

  /**
   * Delete a marketplace message
   */
  async deleteMessage(streamMessageId: string, userId: string): Promise<void> {
    return messageService.deleteMessage(streamMessageId, userId);
  }
}

export const marketplaceMessageService = new MarketplaceMessageService();
