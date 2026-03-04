import { Types } from 'mongoose';
import { marketplaceChannelRepository } from '../repositories/MarketplaceChannelRepository';
import { IMarketplaceListingChannel } from '../../models/MarketplaceListingChannel';
import { channelService, CreateChannelParams, GetChannelsParams, ChannelResponse } from '../../shared/services/channel/ChannelService';

/**
 * Marketplace Channel Service
 * 
 * Locked to 'marketplace' platform.
 * Uses MarketplaceChannelRepository for all data access.
 */
export class MarketplaceChannelService {
  /**
   * Create or get a marketplace channel
   */
  async createChannel(params: Omit<CreateChannelParams, 'platform'>): Promise<{
    channel: IMarketplaceListingChannel;
    created: boolean;
  }> {
    return channelService.createChannel({
      ...params,
      platform: 'marketplace'
    }) as Promise<{ channel: IMarketplaceListingChannel; created: boolean }>;
  }

  /**
   * Get marketplace channel by ID
   */
  async getChannel(channelId: string, userId: string): Promise<IMarketplaceListingChannel | null> {
    const channel = await marketplaceChannelRepository.findById(channelId);
    if (!channel) return null;

    const isMember = await marketplaceChannelRepository.isMember(channelId, userId);
    if (!isMember) throw new Error('Not a member of this channel');

    return channel;
  }

  /**
   * Get marketplace channel by GetStream ID
   */
  async getChannelByGetstreamId(getstreamChannelId: string, userId: string): Promise<IMarketplaceListingChannel | null> {
    const channel = await marketplaceChannelRepository.findOne({ getstream_channel_id: getstreamChannelId });
    if (!channel) return null;

    if (channel.buyer_id.toString() !== userId && channel.seller_id.toString() !== userId) {
      throw new Error('Not a member of this channel');
    }

    return channel;
  }

  /**
   * Get all marketplace channels for a user
   */
  async getChannelsForUser(params: Omit<GetChannelsParams, 'platform'>): Promise<ChannelResponse[]> {
    return channelService.getChannelsForUser({
      ...params,
      platform: 'marketplace'
    });
  }

  /**
   * Verify membership in a marketplace channel
   */
  async verifyMembership(channelId: string, userId: string): Promise<boolean> {
    return marketplaceChannelRepository.isMember(channelId, userId);
  }

  /**
   * Archive a marketplace channel
   */
  async archiveChannel(channelId: string, userId: string): Promise<void> {
    const isMember = await this.verifyMembership(channelId, userId);
    if (!isMember) throw new Error('Not a member of this channel');

    await marketplaceChannelRepository.updateById(channelId, { status: 'closed' } as any);
    
    // Delegate GetStream hiding to shared service for now to avoid duplication
    return channelService.archiveChannel(channelId, userId, 'marketplace');
  }

  /**
   * Get active offers for seller on marketplace
   */
  async getActiveOffersForSeller(sellerId: string): Promise<IMarketplaceListingChannel[]> {
    const sellerObjectId = new Types.ObjectId(sellerId);
    return marketplaceChannelRepository.find({
      seller_id: sellerObjectId,
      status: 'open',
      'last_offer.status': 'sent',
      $or: [
        { 'last_offer.expiresAt': { $exists: false } },
        { 'last_offer.expiresAt': { $gt: new Date() } },
      ],
    }, { sort: { updatedAt: -1 } });
  }
}

export const marketplaceChannelService = new MarketplaceChannelService();
