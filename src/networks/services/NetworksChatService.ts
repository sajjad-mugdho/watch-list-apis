/**
 * Networks-specific Chat Service wrapper
 *
 * This service wraps the global ChatService for Networks domain use cases:
 * - Create deterministic channel IDs for buyer-seller pairs
 * - Link channels to listing metadata
 * - Update NetworkListingChannel conversation tracking
 * - Manage unread counts automatically
 *
 * REUSE PRINCIPLE:
 * - All GetStream SDK calls go through chatService (NO duplication)
 * - This is just a Networks-specific adapter/wrapper
 * - Keeps domain logic separate from shared infrastructure
 *
 * DEPENDENCY INJECTION:
 * - Takes ChatService as constructor parameter
 * - Takes NetworksChannelRepository as constructor parameter
 * - Easy to unit test with mocked dependencies
 */

import { chatService } from "../../services/ChatService";
import { networksChannelRepository } from "../repositories/NetworksChannelRepository";
import { NetworkListingChannel } from "../models/NetworkListingChannel";
import logger from "../../utils/logger";
import { Types } from "mongoose";

export interface ListingChannelMetadata {
  title: string;
  price?: number;
  thumbnail?: string;
}

/**
 * Networks Chat Service
 *
 * Handles Networks-specific chat operations with deterministic channel creation
 * and automatic state synchronization with NetworkListingChannel model.
 */
export class NetworksChatService {
  chatServiceInstance: typeof chatService;
  channelRepository: typeof networksChannelRepository;

  constructor(
    chatServiceInstance: typeof chatService = chatService,
    channelRepository: typeof networksChannelRepository = networksChannelRepository,
  ) {
    this.chatServiceInstance = chatServiceInstance;
    this.channelRepository = channelRepository;
  }

  /**
   * Create or get channel for listing conversation
   *
   * Returns the SAME channel for the same buyer-seller pair,
   * regardless of which listing. Channels are REUSED across listings.
   *
   * Deterministic algorithm:
   * 1. Sort user IDs alphabetically
   * 2. Create hash: MD5({minId}:{maxId})
   * 3. Use as stable channel identifier
   *
   * @param listingId - Listing ID (for metadata)
   * @param buyerId - Buyer user ID
   * @param sellerId - Seller user ID
   * @param listingData - Listing metadata for channel
   * @returns { channel, networkChannel } - GetStream channel + NetworkListingChannel
   */
  async getOrCreateListingChannel(
    listingId: string,
    buyerId: string,
    sellerId: string,
    listingData: ListingChannelMetadata,
  ) {
    try {
      // Create deterministic channel ID
      // Format: networks-listing-{listingId} for Networks channels
      const channelId = `networks-listing-${listingId}`;

      logger.info("Creating/getting Networks listing channel", {
        listingId,
        buyerId,
        sellerId,
        channelId,
      });

      // Use ChatService to interact with GetStream (shared infrastructure - REUSE)
      const channel = await this.chatServiceInstance.getOrCreateChannel(
        "messaging",
        channelId,
        {
          listing_id: listingId,
          listing_title: listingData.title,
          listing_price: listingData.price,
          listing_thumbnail: listingData.thumbnail,
        },
      );

      // Upsert in Networks collection
      const networkChannel = await NetworkListingChannel.findOneAndUpdate(
        {
          listing_id: new Types.ObjectId(listingId),
          buyer_id: new Types.ObjectId(buyerId),
          seller_id: new Types.ObjectId(sellerId),
        },
        {
          listing_id: new Types.ObjectId(listingId),
          buyer_id: new Types.ObjectId(buyerId),
          seller_id: new Types.ObjectId(sellerId),
          getstream_channel_id: channelId,
          getstream_channel_type: "messaging",
          status: "open",
          participants: [buyerId, sellerId],
          updatedAt: new Date(),
        },
        { upsert: true, new: true },
      );

      logger.info("Networks listing channel ready", {
        channelId,
        getStreamChannelId: channelId,
        networkChannelId: networkChannel._id,
      });

      return {
        channel,
        networkChannel,
      };
    } catch (error) {
      logger.error("Error creating Networks listing channel", {
        error,
        listingId,
        buyerId,
        sellerId,
      });
      throw error;
    }
  }

  /**
   * Get user's listing conversations
   *
   * For a given user, return all their active conversations
   * enriched with GetStream real-time data (unread counts, member status)
   *
   * @param userId - User ID
   * @param limit - Max conversations to return (default 20)
   * @returns Array of conversations with GetStream enrichment
   */
  async getUserListingChannels(userId: string, limit = 20) {
    try {
      // Get from Networks collection
      const channels = await this.channelRepository.findForUser(
        userId,
        undefined, // No role filter - return all
        "open", // Only active channels
      );

      logger.info("Retrieved user listing channels", {
        userId,
        count: channels.length,
      });

      // Enrich with GetStream data (unread counts, member status)
      const enriched = await Promise.all(
        channels.slice(0, limit).map(async (ch: any) => {
          try {
            // Get GetStream channel state
            const getstreamChannel = await this.chatServiceInstance.getChannel(
              ch.getstream_channel_id || "",
            );

            return {
              id: ch._id,
              listing_id: ch.listing_id,
              buyer_id: ch.buyer_id,
              seller_id: ch.seller_id,
              status: ch.status,
              unread_count: ch.unread_count || 0, // From MongoDB
              last_message_at: ch.last_message_at,
              last_message_preview: ch.last_message_preview,
              members: getstreamChannel?.state?.members || [],
              created_at: ch.created_at || (ch as any).createdAt,
            };
          } catch (err) {
            // If GetStream lookup fails, return Network data only
            logger.warn("Could not enrich with GetStream data", {
              channelId: ch.getstream_channel_id,
              error: err,
            });
            return {
              id: ch._id,
              listing_id: ch.listing_id,
              buyer_id: ch.buyer_id,
              seller_id: ch.seller_id,
              status: ch.status,
              unread_count: ch.unread_count || 0,
              last_message_at: ch.last_message_at,
              last_message_preview: ch.last_message_preview,
              created_at: ch.createdAt,
            };
          }
        }),
      );

      return enriched;
    } catch (error) {
      logger.error("Error retrieving user listing channels", {
        error,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update unread count in MongoDB
   *
   * Called by webhook handler when message.new is received.
   * Increments unread_count for the recipient (not sender).
   *
   * @param channelId - GetStream channel ID
   * @param recipientId - User ID to increment unread for (TODO: Use in Phase 3 for per-user tracking)
   * @param delta - Amount to change (usually +1 for new message)
   */
  async updateUnreadCount(
    channelId: string,
    recipientId: string,
    delta: number,
  ): Promise<void> {
    try {
      const result = await NetworkListingChannel.findOneAndUpdate(
        { getstream_channel_id: channelId },
        {
          $inc: { unread_count: delta },
          $set: { updatedAt: new Date() },
        },
        { new: true },
      );

      if (!result) {
        logger.warn("NetworkListingChannel not found for unread update", {
          channelId,
        });
        return;
      }

      logger.info("Unread count updated", {
        channelId,
        recipientId,
        delta,
        newUnreadCount: (result as any).unread_count,
      });
    } catch (error) {
      logger.error("Error updating unread count", {
        error,
        channelId,
        recipientId,
      });
      throw error;
    }
  }

  /**
   * Mark channel as read
   * Syncs unread state with both GetStream and MongoDB
   *
   * @param channelId - GetStream channel ID
   * @param userId - User who marked as read
   */
  async markChannelAsRead(channelId: string, userId: string): Promise<void> {
    try {
      // Sync with GetStream
      try {
        await chatService.ensureConnected();
        const client = chatService.getClient();
        const channel = client.channel("messaging", channelId);
        await channel.markRead({ user_id: userId });

        logger.debug("GetStream channel marked as read", { channelId, userId });
      } catch (streamError) {
        logger.warn("Failed to sync with GetStream for mark-read", {
          channelId,
          userId,
          error: streamError,
        });
      }

      // Update MongoDB for persistence
      const result = await NetworkListingChannel.findOneAndUpdate(
        { getstream_channel_id: channelId },
        {
          $set: {
            unread_count: 0,
            last_read_at: new Date(),
            updatedAt: new Date(),
          },
        },
        { new: true },
      );

      if (!result) {
        logger.warn("NetworkListingChannel not found for mark as read", {
          channelId,
        });
        return;
      }

      logger.info("Channel marked as read", { channelId, userId });
    } catch (error) {
      logger.error("Error marking channel as read", {
        error,
        channelId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update message metadata in NetworkListingChannel
   *
   * Called when message.new webhook arrives.
   * Updates last_message_at, last_message_preview, last_message_sender_id.
   *
   * @param channelId - GetStream channel ID
   * @param messageText - Message text (for preview)
   * @param senderId - User who sent the message
   */
  async updateLastMessage(
    channelId: string,
    messageText: string,
    senderId: string,
  ): Promise<void> {
    try {
      // Truncate preview to 100 chars
      const preview = messageText.substring(0, 100);

      const result = await NetworkListingChannel.findOneAndUpdate(
        { getstream_channel_id: channelId },
        {
          $set: {
            last_message_at: new Date(),
            last_message_preview: preview,
            last_message_sender_id: senderId,
            updatedAt: new Date(),
          },
        },
        { new: true },
      );

      if (!result) {
        logger.warn("NetworkListingChannel not found for message update", {
          channelId,
        });
        return;
      }

      logger.debug("Last message metadata updated", {
        channelId,
        senderId,
      });
    } catch (error) {
      logger.error("Error updating last message metadata", {
        error,
        channelId,
      });
      throw error;
    }
  }

  /**
   * Get channel details
   *
   * Retrieve channel information from GetStream.
   * Used for fetching member lists, last message, etc.
   *
   * @param channelId - GetStream channel ID
   * @returns GetStream channel object
   */
  async getChannel(channelId: string) {
    try {
      const channel = await this.chatServiceInstance.getChannel(channelId);

      return channel;
    } catch (error) {
      logger.error("Error retrieving channel from GetStream", {
        error,
        channelId,
      });
      throw error;
    }
  }
}

// Export singleton instance for use throughout Networks module
export const networksChatService = new NetworksChatService();
