import { offerService } from '../../../src/services/offer/OfferService';
import { MarketplaceListingChannel } from '../../../src/models/MarketplaceListingChannel';
import { MarketplaceListing } from '../../../src/models/Listings';
import { Offer } from '../../../src/models/Offer';
import { EventOutbox } from '../../../src/models/EventOutbox';
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
      title: 'Rolex Submariner',
      author: { _id: new Types.ObjectId(sellerId), name: 'Test Seller' },
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
      it('should successfully send an initial offer and write to EventOutbox', async () => {
      // Execute
      const { offer, revision } = await offerService.sendOffer({
        channelId,
        listingId,
        senderId: buyerId,
        receiverId: sellerId,
        amount: 14000,
        platform: 'marketplace',
        getstreamChannelId: 'gs_channel_123'
      });

      // Verify response
      expect(offer).toBeDefined();
      expect(revision).toBeDefined();
      expect(revision.amount).toBe(14000);
      expect(offer.state).toBe('CREATED');

      // Verify DB update
      const updatedChannel = await MarketplaceListingChannel.findById(channelId);
      expect(updatedChannel?.last_offer?.amount).toBe(14000);

      // Verify EventOutbox entry (OfferService uses outbox pattern;
      // events.emit('offer:sent') is called by outboxPublisherWorker, not here)
      const outboxEntry = await EventOutbox.findOne({
        event_type: 'OFFER_CREATED',
        'payload.channelId': channelId,
      });
      expect(outboxEntry).toBeDefined();
      expect(outboxEntry?.payload.amount).toBe(14000);
      expect(outboxEntry?.payload.platform).toBe('marketplace');
    });

    it('should throw error if amount is above asking price', async () => {
      await expect(offerService.sendOffer({
        channelId,
        listingId,
        senderId: buyerId,
        receiverId: sellerId,
        amount: 16000,
        platform: 'marketplace',
        getstreamChannelId: 'gs_channel_123'
      })).rejects.toThrow('Offer must be below asking price');
    });

    it('should throw error if listing is not active', async () => {
      await MarketplaceListing.findByIdAndUpdate(listingId, { status: 'sold' });

      await expect(offerService.sendOffer({
        channelId,
        listingId,
        senderId: buyerId,
        receiverId: sellerId,
        amount: 14000,
        platform: 'marketplace',
        getstreamChannelId: 'gs_channel_123'
      })).rejects.toThrow('Listing is not active');
    });
  });

  describe('acceptOffer', () => {
      it('should accept offer, reserve listing, and write to EventOutbox', async () => {
      // 1. Send an offer first
      const { offer } = await offerService.sendOffer({
        channelId,
        listingId,
        senderId: buyerId,
        receiverId: sellerId,
        amount: 14000,
        platform: 'marketplace',
        getstreamChannelId: 'gs_channel_123'
      });

      // 2. Accept (by seller)
      const { amount, channelId: respChannelId } = await offerService.acceptOffer(offer._id.toString(), sellerId, 'marketplace');

      // 3. Verify
      expect(amount).toBe(14000);
      expect(respChannelId).toBe(channelId);

      const listing = await MarketplaceListing.findById(listingId);
      expect(listing?.status).toBe('reserved');
      expect(listing?.order?.buyer_id.toString()).toBe(buyerId);

      const dbOffer = await Offer.findById(offer._id);
      expect(dbOffer?.state).toBe('ACCEPTED');

      // Verify EventOutbox entry (events.emit('offer:accepted') is called by
      // outboxPublisherWorker when it processes this entry, not by OfferService)
      const outboxEntry = await EventOutbox.findOne({
        event_type: 'OFFER_ACCEPTED',
        'payload.channelId': channelId,
      });
      expect(outboxEntry).toBeDefined();
      expect(outboxEntry?.payload.amount).toBe(14000);
    });
  });
});
