import { channelRepository } from '../../../src/repositories/ChannelRepository';
import { MarketplaceListingChannel } from '../../../src/models/MarketplaceListingChannel';
import { NetworkListingChannel } from '../../../src/models/ListingChannel';
import { Types } from 'mongoose';

describe('ChannelRepository', () => {
  const buyerId = new Types.ObjectId().toString();
  const sellerId = new Types.ObjectId().toString();
  const listingId = new Types.ObjectId().toString();

  const buyerSnapshot = { _id: new Types.ObjectId(buyerId), name: 'Test Buyer' };
  const sellerSnapshot = { _id: new Types.ObjectId(sellerId), name: 'Test Seller' };
  const listingSnapshot = { brand: 'Rolex', model: 'Submariner', reference: '126610LN' };

  describe('findByParticipants', () => {
    it('should find a marketplace channel with listingId', async () => {
      // Setup
      await MarketplaceListingChannel.create({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        status: 'open',
        created_from: 'inquiry',
        buyer_snapshot: buyerSnapshot,
        seller_snapshot: sellerSnapshot,
        listing_snapshot: listingSnapshot,
      });

      // Execute
      const channel = await channelRepository.findByParticipants({
        buyerId,
        sellerId,
        listingId,
        platform: 'marketplace'
      });

      // Verify
      expect(channel).toBeDefined();
      expect(channel?.buyer_id.toString()).toBe(buyerId);
      expect(channel?.listing_id.toString()).toBe(listingId);
    });

    it('should find a networks channel regardless of listingId', async () => {
      // Setup
      await NetworkListingChannel.create({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId, // Even if it exists, networks use user-to-user
        status: 'open',
        created_from: 'inquiry',
        buyer_snapshot: buyerSnapshot,
        seller_snapshot: sellerSnapshot,
        listing_snapshot: listingSnapshot,
      });

      // Execute
      const channel = await channelRepository.findByParticipants({
        buyerId,
        sellerId,
        platform: 'networks'
      });

      // Verify
      expect(channel).toBeDefined();
      expect(channel?.buyer_id.toString()).toBe(buyerId);
    });

    it('should find networks channel even if participants are swapped', async () => {
      // Setup
      await NetworkListingChannel.create({
        buyer_id: sellerId,
        seller_id: buyerId,
        listing_id: new Types.ObjectId(),
        status: 'open',
        created_from: 'inquiry',
        buyer_snapshot: sellerSnapshot,
        seller_snapshot: buyerSnapshot,
        listing_snapshot: listingSnapshot,
      });

      // Execute
      const channel = await channelRepository.findByParticipants({
        buyerId,
        sellerId,
        platform: 'networks'
      });

      // Verify
      expect(channel).toBeDefined();
    });
  });

  describe('findForUser', () => {
    it('should find channels where user is buyer or seller', async () => {
      // Setup
      await MarketplaceListingChannel.create([
        { 
          buyer_id: buyerId, 
          seller_id: sellerId, 
          listing_id: new Types.ObjectId(), 
          status: 'open',
          created_from: 'inquiry',
          buyer_snapshot: buyerSnapshot,
          seller_snapshot: sellerSnapshot,
          listing_snapshot: listingSnapshot,
        },
        { 
          buyer_id: new Types.ObjectId(), 
          seller_id: buyerId, 
          listing_id: new Types.ObjectId(), 
          status: 'open',
          created_from: 'inquiry',
          buyer_snapshot: buyerSnapshot,
          seller_snapshot: sellerSnapshot,
          listing_snapshot: listingSnapshot,
        }
      ]);

      // Execute
      const channels = await channelRepository.findForUser({
        userId: buyerId,
        platform: 'marketplace'
      });

      // Verify
      expect(channels.length).toBe(2);
    });

    it('should filter by role', async () => {
       // Setup
       await MarketplaceListingChannel.create([
        { 
          buyer_id: buyerId, 
          seller_id: sellerId, 
          listing_id: new Types.ObjectId(), 
          status: 'open',
          created_from: 'inquiry',
          buyer_snapshot: buyerSnapshot,
          seller_snapshot: sellerSnapshot,
          listing_snapshot: listingSnapshot,
        },
        { 
          buyer_id: new Types.ObjectId(), 
          seller_id: buyerId, 
          listing_id: new Types.ObjectId(), 
          status: 'open',
          created_from: 'inquiry',
          buyer_snapshot: buyerSnapshot,
          seller_snapshot: sellerSnapshot,
          listing_snapshot: listingSnapshot,
        }
      ]);

      // Execute
      const channels = await channelRepository.findForUser({
        userId: buyerId,
        platform: 'marketplace',
        role: 'buyer'
      });

      // Verify
      expect(channels.length).toBe(1);
    });
  });
});
