import { channelRepository } from '../../../src/repositories/ChannelRepository';
import { MarketplaceListingChannel } from '../../../src/models/MarketplaceListingChannel';
import { Types } from 'mongoose';

describe('OfferRepository (via ChannelRepository)', () => {
  const buyerId = new Types.ObjectId().toString();
  const sellerId = new Types.ObjectId().toString();
  const listingId = new Types.ObjectId().toString();

  const buyerSnapshot = { _id: new Types.ObjectId(buyerId), name: 'Test Buyer' };
  const sellerSnapshot = { _id: new Types.ObjectId(sellerId), name: 'Test Seller' };
  const listingSnapshot = { brand: 'Rolex', model: 'Submariner', reference: '126610LN' };

  it('should update last offer and offer history', async () => {
    // 1. Create channel
    const channel = await MarketplaceListingChannel.create({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: listingId,
      status: 'open',
      created_from: 'inquiry',
      buyer_snapshot: buyerSnapshot,
      seller_snapshot: sellerSnapshot,
      listing_snapshot: listingSnapshot,
    });

    const offer = {
      _id: new Types.ObjectId(),
      sender_id: buyerId,
      amount: 10000,
      status: 'sent',
      offer_type: 'initial',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 482460 * 1000)
    };

    // 2. Execute
    await channelRepository.updateLastOffer((channel as any)._id.toString(), offer, 'marketplace');

    // 3. Verify
    const updated = await MarketplaceListingChannel.findById(channel._id);
    expect(updated?.last_offer?.amount).toBe(10000);
    expect(updated?.offer_history.length).toBe(1);
    expect(updated?.last_event_type).toBe('offer');
  });

  it('should find channels with expired offers', async () => {
    // 1. Create channel with expired offer
    const expiredDate = new Date();
    expiredDate.setHours(expiredDate.getHours() - 1);

    await MarketplaceListingChannel.create({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: listingId,
      status: 'open',
      created_from: 'offer',
      buyer_snapshot: buyerSnapshot,
      seller_snapshot: sellerSnapshot,
      listing_snapshot: listingSnapshot,
      last_offer: {
        _id: new Types.ObjectId(),
        sender_id: buyerId,
        amount: 5000,
        status: 'sent',
        offer_type: 'initial',
        createdAt: new Date(Date.now() - 502460 * 1000),
        expiresAt: expiredDate
      }
    });

    // 2. Execute
    const expired = await channelRepository.findExpiredOffers('marketplace');

    // 3. Verify
    expect(expired.length).toBe(1);
  });
});
