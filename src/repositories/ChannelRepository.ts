/**
 * Channel Repository
 * 
 * Data access layer for marketplace and networks channels.
 * Handles platform-specific queries with unified interface.
 */

import { Types } from 'mongoose';
import { BaseRepository } from './base/BaseRepository';
import { 
  MarketplaceListingChannel, 
  IMarketplaceListingChannel 
} from '../models/MarketplaceListingChannel';
import { 
  NetworkListingChannel, 
  INetworkListingChannel 
} from '../models/ListingChannel';

export type Platform = 'marketplace' | 'networks';
export type Channel = IMarketplaceListingChannel | INetworkListingChannel;

export interface FindByParticipantsParams {
  buyerId: string;
  sellerId: string;
  listingId?: string;
  platform: Platform;
}

export interface FindForUserParams {
  userId: string;
  platform: Platform;
  role?: 'buyer' | 'seller';
  status?: string;
}

export class ChannelRepository {
  private marketplaceRepo: BaseRepository<IMarketplaceListingChannel>;
  private networksRepo: BaseRepository<INetworkListingChannel>;

  constructor() {
    // Create typed repositories for each platform
    this.marketplaceRepo = new (class extends BaseRepository<IMarketplaceListingChannel> {
      constructor() {
        super(MarketplaceListingChannel as any);
      }
    })() as any;

    this.networksRepo = new (class extends BaseRepository<INetworkListingChannel> {
      constructor() {
        super(NetworkListingChannel as any);
      }
    })() as any;
  }

  /**
   * Find channel by participants
   * 
   * Marketplace: unique per (listing, buyer, seller)
   * Networks: unique per (buyer, seller) - ignores listing
   */
  async findByParticipants(params: FindByParticipantsParams): Promise<Channel | null> {
    const { buyerId, sellerId, listingId, platform } = params;

    if (platform === 'marketplace') {
      if (!listingId) {
        throw new Error('listingId required for marketplace channels');
      }
      return this.marketplaceRepo.findOne({
        buyer_id: new Types.ObjectId(buyerId),
        seller_id: new Types.ObjectId(sellerId),
        listing_id: new Types.ObjectId(listingId),
      });
    } else {
      // Networks: user-to-user unique (bidirectional)
      return this.networksRepo.findOne({
        $or: [
          { buyer_id: new Types.ObjectId(buyerId), seller_id: new Types.ObjectId(sellerId) },
          { buyer_id: new Types.ObjectId(sellerId), seller_id: new Types.ObjectId(buyerId) },
        ],
      });
    }
  }

  /**
   * Find channel by ID
   */
  async findById(channelId: string, platform: Platform): Promise<Channel | null> {
    const repo = this.getRepo(platform);
    return repo.findById(channelId);
  }

  /**
   * Find channel by GetStream channel ID
   */
  async findByGetstreamId(
    getstreamChannelId: string, 
    platform: Platform
  ): Promise<Channel | null> {
    const repo = this.getRepo(platform);
    return repo.findOne({ getstream_channel_id: getstreamChannelId });
  }

  /**
   * Find all channels for a user
   */
  async findForUser(params: FindForUserParams): Promise<Channel[]> {
    const { userId, platform, role, status } = params;
    const repo = this.getRepo(platform);
    const userObjectId = new Types.ObjectId(userId);

    // Build filter based on role
    let filter: any = {};
    if (role === 'buyer') {
      filter.buyer_id = userObjectId;
    } else if (role === 'seller') {
      filter.seller_id = userObjectId;
    } else {
      filter.$or = [
        { buyer_id: userObjectId },
        { seller_id: userObjectId },
      ];
    }

    if (status) {
      filter.status = status;
    }

    return repo.find(filter, { 
      sort: { updatedAt: -1 }, 
      limit: 50 
    });
  }

  /**
   * Find channels with active offers for a seller
   */
  async findActiveOffersForSeller(
    sellerId: string, 
    platform: Platform
  ): Promise<Channel[]> {
    const repo = this.getRepo(platform);
    return repo.find({
      seller_id: new Types.ObjectId(sellerId),
      status: 'open',
      'last_offer.status': 'sent',
      $or: [
        { 'last_offer.expiresAt': { $exists: false } },
        { 'last_offer.expiresAt': { $gt: new Date() } },
      ],
    }, { sort: { updatedAt: -1 } });
  }

  /**
   * Find all channels with expired offers (for background job)
   */
  async findExpiredOffers(platform: Platform): Promise<Channel[]> {
    const repo = this.getRepo(platform);
    return repo.find({
      'last_offer.status': 'sent',
      'last_offer.expiresAt': { $lt: new Date() },
    });
  }

  /**
   * Create a new channel
   */
  async create(data: Partial<Channel>, platform: Platform): Promise<Channel> {
    const repo = this.getRepo(platform);
    return repo.create(data);
  }

  /**
   * Update channel by ID
   */
  async updateById(
    channelId: string, 
    update: Partial<Channel>, 
    platform: Platform
  ): Promise<Channel | null> {
    const repo = this.getRepo(platform);
    return repo.updateById(channelId, update);
  }

  /**
   * Update channel's last offer
   */
  async updateLastOffer(
    channelId: string,
    offer: any,
    platform: Platform
  ): Promise<Channel | null> {
    const repo = this.getRepo(platform);
    return repo.updateById(channelId, {
      $set: { 
        last_offer: offer,
        last_event_type: 'offer',
      },
      $push: { offer_history: offer },
    } as any);
  }

  /**
   * Archive a channel (mark as closed)
   */
  async archive(channelId: string, platform: Platform): Promise<Channel | null> {
    const repo = this.getRepo(platform);
    return repo.updateById(channelId, { status: 'closed' } as any);
  }

  /**
   * Count channels for a user
   */
  async countForUser(userId: string, platform: Platform): Promise<number> {
    const repo = this.getRepo(platform);
    const userObjectId = new Types.ObjectId(userId);
    return repo.count({
      $or: [
        { buyer_id: userObjectId },
        { seller_id: userObjectId },
      ],
    });
  }

  /**
   * Check if user is member of channel
   */
  async isMember(
    channelId: string, 
    userId: string, 
    platform: Platform
  ): Promise<boolean> {
    const channel = await this.findById(channelId, platform);
    if (!channel) return false;

    return (
      channel.buyer_id.toString() === userId ||
      channel.seller_id.toString() === userId
    );
  }

  /**
   * Get the appropriate repository for platform
   */
  private getRepo(platform: Platform) {
    return platform === 'marketplace' 
      ? this.marketplaceRepo 
      : this.networksRepo;
  }
}

// Singleton instance
export const channelRepository = new ChannelRepository();
