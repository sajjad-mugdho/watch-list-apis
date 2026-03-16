import { Types } from "mongoose";
import { BaseRepository } from "../../shared/repositories/base/BaseRepository";
import {
  MarketplaceListingChannel,
  IMarketplaceListingChannel,
} from "../models/MarketplaceListingChannel";

/**
 * Marketplace Channel Repository
 *
 * Data access layer for marketplace-specific channels.
 * Enforces listing-scoped uniqueness logic.
 */
export class MarketplaceChannelRepository extends BaseRepository<IMarketplaceListingChannel> {
  constructor() {
    super(MarketplaceListingChannel as any);
  }

  /**
   * Find a marketplace channel by participants and listing
   */
  async findByParticipants(
    buyerId: string,
    sellerId: string,
    listingId: string,
  ): Promise<IMarketplaceListingChannel | null> {
    return this.findOne({
      buyer_id: new Types.ObjectId(buyerId),
      seller_id: new Types.ObjectId(sellerId),
      listing_id: new Types.ObjectId(listingId),
    });
  }

  /**
   * Find all marketplace channels for a user
   */
  async findForUser(
    userId: string,
    role?: "buyer" | "seller",
    status?: string,
  ): Promise<IMarketplaceListingChannel[]> {
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
   * Check if user is member of a marketplace channel
   */
  async isMember(channelId: string, userId: string): Promise<boolean> {
    const channel = await this.findById(channelId);
    if (!channel) return false;
    return (
      channel.buyer_id.toString() === userId ||
      channel.seller_id.toString() === userId
    );
  }
}

export const marketplaceChannelRepository = new MarketplaceChannelRepository();
