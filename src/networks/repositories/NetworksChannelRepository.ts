import { Types } from "mongoose";
import { BaseRepository } from "../../shared/repositories/base/BaseRepository";
import {
  NetworkListingChannel,
  INetworkListingChannel,
} from "../models/NetworkListingChannel";

/**
 * Networks Channel Repository
 *
 * Data access layer for networks-specific channels.
 * Enforces user-to-user pair logic (reused across listings).
 */
export class NetworksChannelRepository extends BaseRepository<INetworkListingChannel> {
  constructor() {
    super(NetworkListingChannel as any);
  }

  /**
   * Find a networks channel by user pair (reused across listings)
   */
  async findByUserPair(
    user1Id: string,
    user2Id: string,
  ): Promise<INetworkListingChannel | null> {
    return this.findOne({
      $or: [
        {
          buyer_id: new Types.ObjectId(user1Id),
          seller_id: new Types.ObjectId(user2Id),
        },
        {
          buyer_id: new Types.ObjectId(user2Id),
          seller_id: new Types.ObjectId(user1Id),
        },
      ],
    });
  }

  /**
   * Find all networks channels for a user
   */
  async findForUser(
    userId: string,
    role?: "buyer" | "seller",
    status?: string,
  ): Promise<INetworkListingChannel[]> {
    const userObjectId = new Types.ObjectId(userId);
    let filter: any = {};

    if (role === "buyer") {
      filter.buyer_id = userObjectId;
    } else if (role === "seller") {
      filter.seller_id = userObjectId;
    } else {
      filter.$or = [{ buyer_id: userObjectId }, { seller_id: userObjectId }];
    }

    if (status) filter.status = status;

    return this.find(filter, { sort: { updatedAt: -1 }, limit: 50 });
  }

  /**
   * Check if user is member of a networks channel
   * Supports both MongoDB _id and GetStream channel IDs for backward compatibility
   */
  async isMember(channelId: string, userId: string): Promise<boolean> {
    const channel = await this.findOne({
      $or: [
        { getstream_channel_id: channelId },
        ...(Types.ObjectId.isValid(channelId)
          ? [{ _id: new Types.ObjectId(channelId) }]
          : []),
      ],
    });
    if (!channel) return false;
    return (
      channel.buyer_id.toString() === userId ||
      channel.seller_id.toString() === userId
    );
  }

  /**
   * Update unread count for a channel
   * Called by webhook handler when message.new is received
   *
   * @param channelId - GetStream channel ID
   * @param delta - Amount to increment (usually +1)
   * @returns Updated channel
   */
  async updateUnreadCount(
    channelId: string,
    delta: number,
  ): Promise<INetworkListingChannel | null> {
    return await this.updateOne(
      { getstream_channel_id: channelId },
      {
        $inc: { unread_count: delta },
        $set: { updatedAt: new Date() },
      },
    );
  }

  /**
   * Clear unread count when user marks channel as read
   *
   * @param channelId - GetStream channel ID
   * @returns Updated channel
   */
  async clearUnreadCount(
    channelId: string,
  ): Promise<INetworkListingChannel | null> {
    return await this.updateOne(
      { getstream_channel_id: channelId },
      {
        $set: {
          unread_count: 0,
          last_read_at: new Date(),
          updatedAt: new Date(),
        },
      },
    );
  }

  /**
   * Update last message metadata in a channel
   * Called by webhook handler to track conversation preview
   *
   * @param channelId - GetStream channel ID
   * @param messageText - Message text (for preview)
   * @param senderId - User who sent the message
   * @returns Updated channel
   */
  async updateLastMessage(
    channelId: string,
    messageText: string,
    senderId: string,
  ): Promise<INetworkListingChannel | null> {
    return await this.updateOne(
      { getstream_channel_id: channelId },
      {
        $set: {
          last_message_at: new Date(),
          last_message_preview: messageText.substring(0, 100),
          last_message_sender_id: senderId,
          updatedAt: new Date(),
        },
      },
    );
  }
}

export const networksChannelRepository = new NetworksChannelRepository();
