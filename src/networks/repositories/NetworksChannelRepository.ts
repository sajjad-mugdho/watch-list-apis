import { Types } from 'mongoose';
import { BaseRepository } from '../../shared/repositories/base/BaseRepository';
import { 
  NetworkListingChannel, 
  INetworkListingChannel 
} from '../../models/ListingChannel';

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
  async findByUserPair(user1Id: string, user2Id: string): Promise<INetworkListingChannel | null> {
    return this.findOne({
      $or: [
        { buyer_id: new Types.ObjectId(user1Id), seller_id: new Types.ObjectId(user2Id) },
        { buyer_id: new Types.ObjectId(user2Id), seller_id: new Types.ObjectId(user1Id) },
      ],
    });
  }

  /**
   * Find all networks channels for a user
   */
  async findForUser(userId: string, role?: 'buyer' | 'seller', status?: string): Promise<INetworkListingChannel[]> {
    const userObjectId = new Types.ObjectId(userId);
    let filter: any = {};
    
    if (role === 'buyer') {
      filter.buyer_id = userObjectId;
    } else if (role === 'seller') {
      filter.seller_id = userObjectId;
    } else {
      filter.$or = [{ buyer_id: userObjectId }, { seller_id: userObjectId }];
    }

    if (status) filter.status = status;

    return this.find(filter, { sort: { updatedAt: -1 }, limit: 50 });
  }

  /**
   * Check if user is member of a networks channel
   */
  async isMember(channelId: string, userId: string): Promise<boolean> {
    const channel = await this.findById(channelId);
    if (!channel) return false;
    return channel.buyer_id.toString() === userId || channel.seller_id.toString() === userId;
  }
}

export const networksChannelRepository = new NetworksChannelRepository();
