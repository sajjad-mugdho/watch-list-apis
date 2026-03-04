import { Types } from 'mongoose';
import { networksChannelRepository } from '../repositories/NetworksChannelRepository';
import { INetworkListingChannel } from '../../models/ListingChannel';
import { channelService, CreateChannelParams, GetChannelsParams, ChannelResponse } from '../../shared/services/channel/ChannelService';

/**
 * Networks Channel Service
 * 
 * Locked to 'networks' platform.
 * Uses NetworksChannelRepository for all data access.
 */
export class NetworksChannelService {
  /**
   * Create or get a networks channel
   */
  async createChannel(params: Omit<CreateChannelParams, 'platform'>): Promise<{
    channel: INetworkListingChannel;
    created: boolean;
  }> {
    return channelService.createChannel({
      ...params,
      platform: 'networks'
    }) as Promise<{ channel: INetworkListingChannel; created: boolean }>;
  }

  /**
   * Get networks channel by ID
   */
  async getChannel(channelId: string, userId: string): Promise<INetworkListingChannel | null> {
    const channel = await networksChannelRepository.findById(channelId);
    if (!channel) return null;

    const isMember = await networksChannelRepository.isMember(channelId, userId);
    if (!isMember) throw new Error('Not a member of this channel');

    return channel;
  }

  /**
   * Get networks channel by GetStream ID
   */
  async getChannelByGetstreamId(getstreamChannelId: string, userId: string): Promise<INetworkListingChannel | null> {
    const channel = await networksChannelRepository.findOne({ getstream_channel_id: getstreamChannelId });
    if (!channel) return null;

    if (channel.buyer_id.toString() !== userId && channel.seller_id.toString() !== userId) {
      throw new Error('Not a member of this channel');
    }

    return channel;
  }

  /**
   * Get all networks channels for a user
   */
  async getChannelsForUser(params: Omit<GetChannelsParams, 'platform'>): Promise<ChannelResponse[]> {
    return channelService.getChannelsForUser({
      ...params,
      platform: 'networks'
    });
  }

  /**
   * Verify membership in a networks channel
   */
  async verifyMembership(channelId: string, userId: string): Promise<boolean> {
    return networksChannelRepository.isMember(channelId, userId);
  }

  /**
   * Archive a networks channel
   */
  async archiveChannel(channelId: string, userId: string): Promise<void> {
    const isMember = await this.verifyMembership(channelId, userId);
    if (!isMember) throw new Error('Not a member of this channel');

    await networksChannelRepository.updateById(channelId, { status: 'closed' } as any);
    
    // Delegate GetStream hiding to shared service
    return channelService.archiveChannel(channelId, userId, 'networks');
  }

  /**
   * Get active offers for seller on networks
   */
  async getActiveOffersForSeller(sellerId: string): Promise<INetworkListingChannel[]> {
    const sellerObjectId = new Types.ObjectId(sellerId);
    return networksChannelRepository.find({
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

export const networksChannelService = new NetworksChannelService();
