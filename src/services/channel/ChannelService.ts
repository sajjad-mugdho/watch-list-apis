/**
 * Channel Service
 * 
 * Business logic for channel operations.
 * Orchestrates repositories and external SDKs.
 */


import { Types } from 'mongoose';
import { 
  channelRepository, 
  Channel, 
  Platform,
  userRepository 
} from '../../repositories';
import { MarketplaceListing, NetworkListing } from '../../models/Listings';
import { chatService } from '../ChatService';
import { events } from '../../utils/events';
import cache from '../../utils/cache';
import logger from '../../utils/logger';

export interface CreateChannelParams {
  buyerId: string;
  sellerId: string;
  listingId: string;
  platform: Platform;
  createdFrom: 'inquiry' | 'offer' | 'order';
  listingSnapshot?: {
    brand: string;
    model: string;
    reference: string;
    price?: number;
    condition?: string;
    thumbnail?: string;
  };
}

export interface GetChannelsParams {
  userId: string;
  platform: Platform;
  role?: 'buyer' | 'seller';
  limit?: number;
  offset?: number;
}

export interface ChannelResponse {
  id: string;
  getstreamChannelId: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  listingSnapshot?: any;
  buyerSnapshot?: any;
  sellerSnapshot?: any;
  lastOffer?: any;
}

export class ChannelService {
  /**
   * Create a new channel or return existing one
   * 
   * Business Rules:
   * - Marketplace: Unique per (listing, buyer, seller)
   * - Networks: Unique per (buyer, seller) - reused across listings
   * - Channel is created in GetStream FIRST (real-time ready)
   * - Then persisted to MongoDB
   */
  async createChannel(params: CreateChannelParams): Promise<{
    channel: Channel;
    created: boolean;
  }> {
    const { buyerId, sellerId, listingId, platform, createdFrom, listingSnapshot } = params;

    logger.info('Creating channel', { buyerId, sellerId, listingId, platform });

    // 1. Check if channel already exists
    const existing = await channelRepository.findByParticipants({
      buyerId,
      sellerId,
      listingId,
      platform,
    });

    if (existing) {
      logger.info('Returning existing channel', { channelId: existing._id });
      return { channel: existing, created: false };
    }

    // 2. Resolve listing snapshot if not provided
    let effectiveListingSnapshot = listingSnapshot;
    if (!effectiveListingSnapshot && platform === 'marketplace') {
      const listing = await MarketplaceListing.findById(listingId).lean();
      if (listing) {
        effectiveListingSnapshot = {
          brand: listing.brand,
          model: listing.model,
          reference: listing.reference,
          price: listing.price,
          condition: (listing as any).condition,
          thumbnail: (listing as any).thumbnail,
        };
      }
    } else if (!effectiveListingSnapshot && platform === 'networks') {
      const listing = await NetworkListing.findById(listingId).lean();
      if (listing) {
        effectiveListingSnapshot = {
          brand: listing.brand,
          model: listing.model,
          reference: listing.reference,
          price: listing.price,
          condition: (listing as any).condition,
          thumbnail: (listing as any).thumbnail,
        };
      }
    }

    // 3. Get user snapshots for denormalization
    const [buyerSnapshot, sellerSnapshot] = await Promise.all([
      userRepository.createSnapshot(buyerId),
      userRepository.createSnapshot(sellerId),
    ]);

    if (!buyerSnapshot || !sellerSnapshot) {
      throw new Error('User not found');
    }

    // 4. Create GetStream channel FIRST (real-time ready)
    const listingUnique = platform === 'marketplace';
    const { channelId: getstreamChannelId } = 
      await chatService.getOrCreateChannel(
        buyerId,
        sellerId,
        {
          listing_id: listingId,
          ...(effectiveListingSnapshot ? { 
            listing_title: `${effectiveListingSnapshot.brand} ${effectiveListingSnapshot.model}`,
            ...(effectiveListingSnapshot.price ? { listing_price: effectiveListingSnapshot.price } : {}),
            ...(effectiveListingSnapshot.thumbnail ? { listing_thumbnail: effectiveListingSnapshot.thumbnail } : {}),
          } : {}),
        },
        listingUnique
      );

    // 4. Persist to MongoDB
    const channelData: any = {
      listing_id: new Types.ObjectId(listingId),
      buyer_id: new Types.ObjectId(buyerId),
      seller_id: new Types.ObjectId(sellerId),
      getstream_channel_id: getstreamChannelId,
      status: 'open',
      created_from: createdFrom,
      buyer_snapshot: buyerSnapshot,
      seller_snapshot: sellerSnapshot,
      listing_snapshot: effectiveListingSnapshot || {},
      offer_history: [],
      inquiries: [],
    };

    const channel = await channelRepository.create(channelData, platform);

    // 5. Invalidate caches
    await Promise.all([
      cache.delete(`channels:${platform}:${buyerId}`),
      cache.delete(`channels:${platform}:${sellerId}`),
    ]);

    // 5b. Send system message if inquiry
    if (createdFrom === 'inquiry' && getstreamChannelId) {
      try {
        await chatService.sendSystemMessage(
          getstreamChannelId,
          {
            type: 'inquiry',
            message: effectiveListingSnapshot ? `New inquiry about ${effectiveListingSnapshot.brand} ${effectiveListingSnapshot.model}` : 'New inquiry'
          },
          buyerId
        );
      } catch (error) {
        logger.warn('Failed to send inquiry system message', { getstreamChannelId, error });
      }
    }

    // 6. Emit event for side effects
    events.emit('channel:created', {
      channelId: (channel as any)._id.toString(),
      getstreamChannelId,
      buyerId,
      sellerId,
      listingId,
      platform,
      createdFrom,
    });

    logger.info('Channel created', { 
      channelId: (channel as any)._id, 
      getstreamChannelId 
    });

    return { channel, created: true };
  }

  /**
   * Get channel by ID with membership verification
   */
  async getChannel(
    channelId: string,
    userId: string,
    platform: Platform
  ): Promise<Channel | null> {
    const channel = await channelRepository.findById(channelId, platform);
    
    if (!channel) {
      return null;
    }

    // Verify membership
    const isMember = await this.verifyMembership(channelId, userId, platform);
    if (!isMember) {
      throw new Error('Not a member of this channel');
    }

    return channel;
  }

  /**
   * Get channel by GetStream ID
   */
  async getChannelByGetstreamId(
    getstreamChannelId: string,
    userId: string,
    platform: Platform
  ): Promise<Channel | null> {
    const channel = await channelRepository.findByGetstreamId(
      getstreamChannelId, 
      platform
    );
    
    if (!channel) {
      return null;
    }

    // Verify membership
    const isMember = 
      channel.buyer_id.toString() === userId ||
      channel.seller_id.toString() === userId;
    
    if (!isMember) {
      throw new Error('Not a member of this channel');
    }

    return channel;
  }

  /**
   * Get all channels for a user
   */
  async getChannelsForUser(params: GetChannelsParams): Promise<ChannelResponse[]> {
    const { userId, platform, role, limit = 20, offset = 0 } = params;

    const cacheKey = `channels:${platform}:${userId}${role ? `:${role}` : ''}`;
    
    // 1. Try cache first
    const cached = await cache.get<ChannelResponse[]>(cacheKey);
    if (cached) {
      logger.debug('Returning cached channels', { userId, platform });
      return cached.slice(offset, offset + limit);
    }

    // 2. Fetch from repository
    const channels = await channelRepository.findForUser({
      userId,
      platform,
      ...(role ? { role } : {}),
    });

    // 3. Map to response format
    const response = channels.map(ch => ({
      id: (ch as any)._id.toString(),
      getstreamChannelId: ch.getstream_channel_id || '',
      buyerId: ch.buyer_id.toString(),
      sellerId: ch.seller_id.toString(),
      listingId: ch.listing_id.toString(),
      status: ch.status,
      createdAt: ch.createdAt,
      updatedAt: ch.updatedAt,
      listingSnapshot: (ch as any).listing_snapshot,
      buyerSnapshot: (ch as any).buyer_snapshot,
      sellerSnapshot: (ch as any).seller_snapshot,
      lastOffer: ch.last_offer,
    }));

    // 4. Cache full result for 5 minutes
    await cache.set(cacheKey, response, 300);

    return response.slice(offset, offset + limit);
  }

  /**
   * Verify user is a member of channel
   */
  async verifyMembership(
    channelId: string,
    userId: string,
    platform: Platform
  ): Promise<boolean> {
    return channelRepository.isMember(channelId, userId, platform);
  }

  /**
   * Archive a channel
   */
  async archiveChannel(
    channelId: string,
    userId: string,
    platform: Platform
  ): Promise<void> {
    // Verify membership
    const isMember = await this.verifyMembership(channelId, userId, platform);
    if (!isMember) {
      throw new Error('Not a member of this channel');
    }

    await channelRepository.archive(channelId, platform);
    
    // Archive in GetStream too
    const channel = await channelRepository.findById(channelId, platform);
    if (channel?.getstream_channel_id) {
      try {
        const client = chatService.getClient();
        const streamChannel = client.channel('messaging', channel.getstream_channel_id);
        await streamChannel.hide(userId);
      } catch (error) {
        logger.warn('Failed to hide channel in GetStream', { channelId, error });
      }
    }

    logger.info('Channel archived', { channelId, userId });
  }

  /**
   * Get user's role in a channel
   */
  async getUserRole(
    channelId: string,
    userId: string,
    platform: Platform
  ): Promise<'buyer' | 'seller' | null> {
    const channel = await channelRepository.findById(channelId, platform);
    if (!channel) return null;

    if (channel.buyer_id.toString() === userId) return 'buyer';
    if (channel.seller_id.toString() === userId) return 'seller';
    return null;
  }

  /**
   * Get channels with active offers for seller (for offers tab)
   */
  async getActiveOffersForSeller(
    sellerId: string,
    platform: Platform
  ): Promise<Channel[]> {
    return channelRepository.findActiveOffersForSeller(sellerId, platform);
  }
}

// Singleton instance
export const channelService = new ChannelService();
