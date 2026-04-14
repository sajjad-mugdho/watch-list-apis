import logger from "../../utils/logger";
import { NetworksChannelRepository } from "../repositories/NetworksChannelRepository";

export interface IGetstreamWebhookPayload {
  message?: any;
  channel?: any;
}

export class ChatMessageWebhookHandler {
  constructor(private channelRepo: NetworksChannelRepository) {}

  /**
   * Handle message.new webhook from GetStream
   * Updates unread count and last message metadata
   */
  async handleMessageNew(payload: IGetstreamWebhookPayload): Promise<void> {
    try {
      const { message, channel } = payload;

      if (!message || !channel) {
        logger.warn("Missing message or channel data in webhook payload", {
          messageId: message?.id,
          channelCID: channel?.cid,
        });
        return;
      }

      // Use channel.id (plain ID), fallback to parsing channel.cid if needed
      const channelId =
        channel.id || (channel.cid ? channel.cid.split(":")[1] : undefined);
      if (!channelId) {
        logger.warn("Missing or unparseable channel ID from webhook", {
          channel,
        });
        return;
      }
      const messageText = message.text || "";
      const senderId = message.user?.id;

      if (!senderId) {
        logger.warn("Missing sender ID in message", { messageId: message.id });
        return;
      }

      const updated = await this.channelRepo.updateLastMessage(
        channelId,
        messageText,
        senderId,
      );

      if (!updated) {
        logger.warn("Channel not found for webhook", { channelId });
        return;
      }

      // If message is not from current user, increment unread count
      // (This assumes the webhook is being processed for all channel members)
      if (message.type !== "system") {
        await this.channelRepo.updateUnreadCount(channelId, 1);
      }

      logger.debug("Message webhook processed", {
        channelId,
        messageId: message.id,
        senderId,
      });
    } catch (error) {
      logger.error("Error handling message.new webhook", error);
      throw error;
    }
  }

  /**
   * Handle message.updated webhook from GetStream
   */
  async handleMessageUpdated(payload: IGetstreamWebhookPayload): Promise<void> {
    try {
      const { message, channel } = payload;

      if (!message || !channel) {
        logger.warn("Missing message or channel data in webhook payload");
        return;
      }

      logger.debug("Message update webhook received", {
        channelId: channel.cid,
        messageId: message.id,
      });
      // Currently just logging - extend as needed
    } catch (error) {
      logger.error("Error handling message.updated webhook", error);
      throw error;
    }
  }

  /**
   * Handle message.deleted webhook from GetStream
   */
  async handleMessageDeleted(payload: IGetstreamWebhookPayload): Promise<void> {
    try {
      const { message, channel } = payload;

      if (!message || !channel) {
        logger.warn("Missing message or channel data in webhook payload");
        return;
      }

      logger.debug("Message delete webhook received", {
        channelId: channel.cid,
        messageId: message.id,
      });
      // Currently just logging - extend as needed
    } catch (error) {
      logger.error("Error handling message.deleted webhook", error);
      throw error;
    }
  }

  /**
   * Handle channel.updated webhook from GetStream
   */
  async handleChannelUpdated(payload: IGetstreamWebhookPayload): Promise<void> {
    try {
      const { channel } = payload;

      if (!channel) {
        logger.warn("Missing channel data in webhook payload");
        return;
      }

      logger.debug("Channel update webhook received", {
        channelId: channel.cid,
      });
      // Currently just logging - extend as needed
    } catch (error) {
      logger.error("Error handling channel.updated webhook", error);
      throw error;
    }
  }
}
