import { offerService } from '../../../src/services/offer/OfferService';
import { MarketplaceListingChannel } from '../../../src/models/MarketplaceListingChannel';
import { MarketplaceListing } from '../../../src/models/Listings';
import { events } from '../../../src/utils/events';
import { Types } from 'mongoose';

describe('OfferService', () => {
  const buyerId = new Types.ObjectId().toString();
  const sellerId = new Types.ObjectId().toString();
  
  let listingId: string;
  let channelId: string;

  const buyerSnapshot = { _id: new Types.ObjectId(buyerId), name: 'Test Buyer' };
  const sellerSnapshot = { _id: new Types.ObjectId(sellerId), name: 'Test Seller' };
  const listingSnapshot = { brand: 'Rolex', model: 'Submariner', reference: '126610LN' };

  beforeEach(async () => {
    // 1. Create a listing
    const listing = await MarketplaceListing.create({
      dialist_id: sellerId,
      clerk_id: 'clerk_seller_123',
      watch_id: new Types.ObjectId(),
      brand: 'Rolex',
      model: 'Submariner',
      reference: '126610LN',
      diameter: '41mm',
      bezel: 'Ceramic',
      materials: 'Oystersteel',
      bracelet: 'Oyster',
      ships_from: { country: 'US' },
      watch_snapshot: {
        brand: 'Rolex',
        model: 'Submariner',
        reference: '126610LN',
        diameter: '41mm',
        bezel: 'Ceramic',
        materials: 'Oystersteel',
        bracelet: 'Oyster',
      },
      price: 15000,
      status: 'active',
      allow_offers: true,
    });
    listingId = (listing as any)._id.toString();

    // 2. Create a channel
    const channel = await MarketplaceListingChannel.create({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: sellerId,
      status: 'open',
      created_from: 'inquiry',
      buyer_snapshot: buyerSnapshot,
      seller_snapshot: sellerSnapshot,
      listing_snapshot: listingSnapshot,
    });
    channelId = (channel as any)._id.toString();
  });

  describe('sendOffer', () => {
    it('should successfully send an initial offer and emit an event', async () => {
      const emitSpy = jest.spyOn(events, 'emit');

      // Execute
      const response = await offerService.sendOffer({
        channelId,
        listingId,
        senderId: buyerId,
        amount: 14000,
        platform: 'marketplace'
      });

      // Verify response
      expect(response.amount).toBe(14000);
      expect(response.status).toBe('sent');

      // Verify DB update
      const updatedChannel = await MarketplaceListingChannel.findById(channelId);
      expect(updatedChannel?.last_offer?.amount).toBe(14000);

      // Verify event emission
      expect(emitSpy).toHaveBeenCalledWith('offer:sent', expect.objectContaining({
        amount: 14000,
        platform: 'marketplace'
      }));
    });

    it('should throw error if amount is above asking price', async () => {
      await expect(offerService.sendOffer({
        channelId,
        listingId,
        senderId: buyerId,
        amount: 16000,
        platform: 'marketplace'
      })).rejects.toThrow('Offer must be below asking price');
    });

    it('should throw error if listing is not active', async () => {
      await MarketplaceListing.findByIdAndUpdate(listingId, { status: 'sold' });

      await expect(offerService.sendOffer({
        channelId,
        listingId,
        senderId: buyerId,
        amount: 14000,
        platform: 'marketplace'
      })).rejects.toThrow('Listing is not active');
    });
  });

  describe('acceptOffer', () => {
    it('should accept offer, reserve listing, and emit event', async () => {
      // 1. Send an offer first
      await offerService.sendOffer({
        channelId,
        listingId,
        senderId: buyerId,
        amount: 14000,
        platform: 'marketplace'
      });

      const emitSpy = jest.spyOn(events, 'emit');

      // 2. Accept (by seller)
      const { orderId } = await offerService.acceptOffer(channelId, sellerId, 'marketplace');

      // 3. Verify
      expect(orderId).toBeDefined();

      const listing = await MarketplaceListing.findById(listingId);
      expect(listing?.status).toBe('reserved');
      expect(listing?.order?.buyer_id.toString()).toBe(buyerId);

      const channel = await MarketplaceListingChannel.findById(channelId);
      expect(channel?.last_offer?.status).toBe('accepted');

      expect(emitSpy).toHaveBeenCalledWith('offer:accepted', expect.objectContaining({
        orderId,
        amount: 14000
      }));
    });
  });
});
