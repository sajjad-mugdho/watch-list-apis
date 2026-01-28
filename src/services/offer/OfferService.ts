/**
 * Offer Service
 * 
 * Business logic for offer lifecycle management.
 * 
 * Key rules (per Michael's Q&A):
 * - One active offer per buyer per channel
 * - Counter-offer invalidates previous offer
 * - Offers expire after 48 hours automatically
 * - Cannot offer on reserved listings
 * - Can inquire on reserved listings
 */

import { Types } from 'mongoose';
import { 
  channelRepository, 
  Platform,
  Channel 
} from '../../repositories';
import { MarketplaceListing, NetworkListing } from '../../models/Listings';
import { chatService } from '../ChatService';
import { events } from '../../utils/events';
import logger from '../../utils/logger';
import { Order } from '../../models/Order';

// Offer expiry duration (48 hours)
const OFFER_EXPIRY_HOURS = 48;

export interface SendOfferParams {
  channelId: string;
  listingId: string;
  senderId: string;
  amount: number;
  message?: string;
  platform: Platform;
}

export interface CounterOfferParams {
  channelId: string;
  senderId: string;
  amount: number;
  message?: string;
  platform: Platform;
}

export interface OfferResponse {
  id: string;
  senderId: string;
  amount: number;
  status: string;
  type: 'initial' | 'counter';
  expiresAt: Date;
  createdAt: Date;
  message?: string;
}

export class OfferService {
  /**
   * Send a new offer
   * 
   * Business Rules:
   * - Listing must be active and allow offers
   * - Cannot offer on own listing
   * - Offer must be positive
   * - Cannot have multiple active offers in same channel
   * - Offer expires after 48 hours
   */
  async sendOffer(params: SendOfferParams): Promise<OfferResponse> {
    const { channelId, listingId, senderId, amount, message, platform } = params;

    logger.info('Sending offer', { channelId, listingId, senderId, amount });

    // 1. Validate listing eligibility
    const ListingModel = platform === 'marketplace' ? MarketplaceListing : NetworkListing;
    const listing = await (ListingModel as any).findById(listingId);
    
    if (!listing) throw new Error('Listing not found');
    if (listing.status !== 'active') throw new Error('Listing is not active');
    if (!listing.allow_offers) throw new Error('Offers not allowed on this listing');
    if (listing.dialist_id.toString() === senderId) throw new Error('Cannot make offer on own listing');
    if (amount <= 0) throw new Error('Offer amount must be positive');
    if (listing.price && amount >= listing.price) {
      throw new Error('Offer must be below asking price');
    }

    // 2. Get channel and verify membership
    let channel = await channelRepository.findById(channelId, platform);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const isMember = 
      channel.buyer_id.toString() === senderId ||
      channel.seller_id.toString() === senderId;
    
    if (!isMember) {
      throw new Error('Not a member of this channel');
    }

    // 3. Check for existing active offer
    if (channel.last_offer && channel.last_offer.status === 'sent') {
      const isExpired = channel.last_offer.expiresAt && 
        new Date(channel.last_offer.expiresAt) <= new Date();
      
      if (!isExpired) {
        throw new Error('An active offer already exists. Accept, counter, or wait for expiry.');
      }
    }

    // 4. Create offer
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + OFFER_EXPIRY_HOURS);

    const offer: any = {
      _id: new Types.ObjectId(),
      sender_id: new Types.ObjectId(senderId),
      amount,
      message: message || null,
      offer_type: 'initial',
      status: 'sent',
      expiresAt,
      createdAt: new Date(),
    };

    // 5. Update channel with offer
    await channelRepository.updateLastOffer(channelId, offer, platform);

    // 6. Send system message via GetStream
    if (channel.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          channel.getstream_channel_id,
          {
            type: 'offer',
            amount,
            offer_id: offer._id.toString(),
            message: message || `Offer of $${amount}`,
          },
          senderId
        );
      } catch (error) {
        logger.warn('Failed to send system message', { channelId, error });
      }
    }

    // 7. Determine receiver
    const receiverId = channel.buyer_id.toString() === senderId
      ? channel.seller_id.toString()
      : channel.buyer_id.toString();

    // 8. Emit event (side effects handled by listeners)
    events.emit('offer:sent', {
      offerId: offer._id.toString(),
      channelId: channel.getstream_channel_id || channelId,
      senderId,
      receiverId,
      amount,
      listingId: listing._id.toString(),
      platform,
    });

    logger.info('Offer sent', { offerId: offer._id, amount });

    return {
      id: offer._id.toString(),
      senderId,
      amount,
      status: 'sent',
      type: 'initial',
      expiresAt,
      createdAt: offer.createdAt,
      ...(message ? { message } : {}),
    };
  }

  /**
   * Send a counter offer
   * 
   * Business Rules:
   * - Buyer counter must NOT exceed current offer
   * - Seller counter must NOT be below current offer
   * - Invalidates previous offer
   */
  async counterOffer(params: CounterOfferParams): Promise<OfferResponse> {
    const { channelId, senderId, amount, message, platform } = params;

    logger.info('Sending counter offer', { channelId, senderId, amount });

    // 1. Get channel and verify
    const channel = await channelRepository.findById(channelId, platform);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // 2. Check for existing offer to counter
    if (!channel.last_offer || channel.last_offer.status !== 'sent') {
      throw new Error('No active offer to counter');
    }

    const lastOffer = channel.last_offer;

    // 3. Verify sender is receiver of current offer
    if (lastOffer.sender_id.toString() === senderId) {
      throw new Error('Cannot counter your own offer');
    }

    // 4. Validate counter amount based on role
    const isBuyer = channel.buyer_id.toString() === senderId;
    if (isBuyer && amount > lastOffer.amount) {
      throw new Error('Buyer counter must not exceed current offer');
    }
    if (!isBuyer && amount < lastOffer.amount) {
      throw new Error('Seller counter must not be below current offer');
    }

    const previousAmount = lastOffer.amount;

    // 5. Create counter offer
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + OFFER_EXPIRY_HOURS);

    const counterOffer: any = {
      _id: new Types.ObjectId(),
      sender_id: new Types.ObjectId(senderId),
      amount,
      message: message || null,
      offer_type: 'counter',
      status: 'sent',
      expiresAt,
      createdAt: new Date(),
    };

    // 6. Invalidate previous offer and set new one
    await channelRepository.updateById(
      channelId,
      {
        $push: { 
          offer_history: { 
            ...lastOffer, 
            status: 'superseded' 
          } 
        },
        $set: { 
          last_offer: counterOffer,
          last_event_type: 'offer',
        },
      } as any,
      platform
    );

    // 7. Send system message
    if (channel.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          channel.getstream_channel_id,
          {
            type: 'counter_offer',
            amount,
            offer_id: counterOffer._id.toString(),
            message: message || `Counter offer of $${amount}`,
          },
          senderId
        );
      } catch (error) {
        logger.warn('Failed to send system message', { channelId, error });
      }
    }

    // 8. Determine receiver and notify
    const originalSenderId = lastOffer.sender_id.toString();

    // 9. Emit event
    events.emit('offer:countered', {
      offerId: counterOffer._id.toString(),
      channelId: channel.getstream_channel_id || channelId,
      senderId,
      receiverId: originalSenderId,
      amount,
      previousAmount,
      platform,
    });

    logger.info('Counter offer sent', { offerId: counterOffer._id, amount });

    return {
      id: counterOffer._id.toString(),
      senderId,
      amount,
      status: 'sent',
      type: 'counter',
      expiresAt,
      createdAt: counterOffer.createdAt,
      ...(message ? { message } : {}),
    };
  }

  /**
   * Accept an offer
   * 
   * Business Rules:
   * - Listing must be active
   * - Reserves listing and creates order
   */
  async acceptOffer(
    channelId: string,
    userId: string,
    platform: Platform
  ): Promise<{ orderId: string }> {
    logger.info('Accepting offer', { channelId, userId });

    const channel = await channelRepository.findById(channelId, platform);
    if (!channel) throw new Error('Channel not found');

    if (!channel.last_offer || channel.last_offer.status !== 'sent') {
      throw new Error('No active offer to accept');
    }

    if (channel.last_offer.sender_id.toString() === userId) {
      throw new Error('Cannot accept your own offer');
    }

    const ListingModel = platform === 'marketplace' ? MarketplaceListing : NetworkListing;
    const listing = await (ListingModel as any).findById(channel.listing_id);
    if (!listing || listing.status !== 'active') {
      throw new Error('Listing is no longer available');
    }

    const offer = channel.last_offer;
    
    // 0. Create Order
    const order = await Order.create({
      listing_type: platform === 'marketplace' ? 'MarketplaceListing' : 'NetworkListing',
      listing_id: new Types.ObjectId(channel.listing_id.toString()),
      listing_snapshot: {
        brand: (listing as any).watch_snapshot?.brand || (listing as any).brand || '',
        model: (listing as any).watch_snapshot?.model || (listing as any).model || '',
        reference: (listing as any).watch_snapshot?.reference || (listing as any).reference || '',
        price: listing.price || 0,
        thumbnail: typeof (listing as any).thumbnail === 'string' ? (listing as any).thumbnail : ((listing as any).images?.[0] || ''),
      },
      buyer_id: new Types.ObjectId(channel.buyer_id.toString()),
      seller_id: new Types.ObjectId(channel.seller_id.toString()),
      amount: offer.amount,
      currency: 'USD',
      status: 'pending',
      channel_type: platform === 'marketplace' ? 'MarketplaceListingChannel' : 'NetworkListingChannel',
      channel_id: new Types.ObjectId(channelId),
      getstream_channel_id: channel.getstream_channel_id,
    });
    
    const orderId = order._id.toString();

    // 1. Update listing status to reserved
    listing.status = 'reserved';
    listing.order = {
      channel_id: channel._id as any,
      buyer_id: channel.buyer_id,
      buyer_name: (channel as any).buyer_snapshot?.name || 'Buyer',
      reserved_at: new Date(),
    };
    await listing.save();

    // 2. Update channel/offer status
    await channelRepository.updateById(
      channelId,
      {
        $push: { offer_history: { ...offer, status: 'accepted' } },
        $set: { 
          last_offer: { ...offer, status: 'accepted' },
          last_event_type: 'order',
          order_id: new Types.ObjectId(orderId),
        },
      } as any,
      platform
    );

    // 3. Send system message
    if (channel.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          channel.getstream_channel_id,
          {
            type: 'offer_accepted',
            amount: offer.amount,
            offer_id: offer._id!.toString(),
            order_id: orderId,
          },
          userId
        );

        await chatService.sendSystemMessage(
          channel.getstream_channel_id,
          {
            type: 'listing_reserved',
            order_id: orderId,
          },
          userId
        );
      } catch (error) {
        logger.warn('Failed to send system messages', { channelId, error });
      }
    }

    // 4. Determine receiver (the one who sent the offer being accepted)
    // const receiverId = offer.sender_id.toString();

    // 5. Emit event
    events.emit('offer:accepted', {
      offerId: offer._id!.toString(),
      channelId: channel.getstream_channel_id || channelId,
      buyerId: channel.buyer_id.toString(),
      sellerId: channel.seller_id.toString(),
      amount: offer.amount,
      orderId,
      platform,
    });

    return { orderId };
  }

  /**
   * Reject an offer
   */
  async rejectOffer(
    channelId: string,
    userId: string,
    platform: Platform
  ): Promise<void> {
    logger.info('Rejecting offer', { channelId, userId });

    const channel = await channelRepository.findById(channelId, platform);
    if (!channel) throw new Error('Channel not found');

    if (!channel.last_offer || channel.last_offer.status !== 'sent') {
      throw new Error('No active offer to reject');
    }

    if (channel.last_offer.sender_id.toString() === userId) {
      throw new Error('Cannot reject your own offer');
    }

    const offer = channel.last_offer;

    // 1. Update status
    await channelRepository.updateById(
      channelId,
      {
        $push: { offer_history: { ...offer, status: 'declined' } },
        $set: { last_offer: { ...offer, status: 'declined' } },
      } as any,
      platform
    );

    // 2. Send system message
    if (channel.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          channel.getstream_channel_id,
          {
            type: 'offer_rejected',
            amount: offer.amount,
            offer_id: offer._id!.toString(),
          },
          userId
        );
      } catch (error) {
        logger.warn('Failed to send system message', { channelId, error });
      }
    }

    // 4. Emit event
    events.emit('offer:rejected', {
      offerId: offer._id!.toString(),
      channelId: channel.getstream_channel_id || channelId,
      buyerId: channel.buyer_id.toString(),
      sellerId: channel.seller_id.toString(),
      amount: offer.amount,
      platform,
    });
  }

  /**
   * Expire an offer
   */
  async expireOffer(channelId: string, platform: Platform): Promise<void> {
    logger.info('Expiring offer', { channelId });

    const channel = await channelRepository.findById(channelId, platform);
    if (!channel?.last_offer) return;

    const offer = channel.last_offer;

    // 1. Update status
    await channelRepository.updateById(
      channelId,
      {
        $push: { offer_history: { ...offer, status: 'expired' } },
        $set: { last_offer: null },
      } as any,
      platform
    );

    // 2. Send system message
    if (channel.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          channel.getstream_channel_id,
          {
            type: 'offer_expired',
            amount: offer.amount,
            message: 'Offer expired',
          },
          'system'
        );
      } catch (error) {
        logger.warn('Failed to send expiry message', { channelId, error });
      }
    }

    // 4. Emit event
    events.emit('offer:expired', {
      offerId: offer._id!.toString(),
      channelId: channel.getstream_channel_id || channelId,
      buyerId: channel.buyer_id.toString(),
      sellerId: channel.seller_id.toString(),
      amount: offer.amount,
    });
  }

  /**
   * Get all expired offers for processing
   */
  async getExpiredOffers(platform: Platform): Promise<Channel[]> {
    return channelRepository.findExpiredOffers(platform);
  }
}

// Singleton instance
export const offerService = new OfferService();
