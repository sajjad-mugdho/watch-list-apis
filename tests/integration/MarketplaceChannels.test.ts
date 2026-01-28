import { Types } from 'mongoose';
import { channelService } from '../../src/services/channel/ChannelService';
import { User } from '../../src/models/User';
import { MarketplaceListing } from '../../src/models/Listings';
import { MarketplaceListingChannel } from '../../src/models/MarketplaceListingChannel';
import { chatService } from '../../src/services/ChatService';

describe('Marketplace Channels Integration', () => {
  let buyer: any;
  let seller: any;
  let listing1: any;
  let listing2: any;

  beforeEach(async () => {
    // 1. Setup Data
    buyer = await User.create({
      clerk_id: `buyer_${Date.now()}`,
      email: `buyer_${Date.now()}@test.com`,
      first_name: 'Buyer',
      last_name: 'One',
      display_name: 'BuyerOne'
    });

    seller = await User.create({
      clerk_id: `seller_${Date.now()}`,
      email: `seller_${Date.now()}@test.com`,
      first_name: 'Seller',
      last_name: 'Two',
      display_name: 'SellerTwo'
    });

    const commonListingData = {
      dialist_id: seller._id,
      clerk_id: seller.clerk_id,
      brand: 'Rolex',
      model: 'Submariner',
      price: 15000,
      status: 'active' as const,
      allow_offers: true,
      author: { _id: seller._id, name: 'Seller' },
      ships_from: { country: 'US' },
      materials: 'Steel',
      bezel: 'Ceramic',
      bracelet: 'Oyster',
      diameter: '40mm',
      watch_snapshot: {
        brand: 'Rolex',
        model: 'Submariner',
        reference: '116610LN',
        diameter: '40mm',
        bezel: 'Ceramic',
        materials: 'Steel',
        bracelet: 'Oyster'
      }
    };

    listing1 = await MarketplaceListing.create({
      ...commonListingData,
      watch_id: new Types.ObjectId(),
      reference: '1'
    });

    listing2 = await MarketplaceListing.create({
      ...commonListingData,
      watch_id: new Types.ObjectId(),
      reference: '2'
    });

    // Mock ChatService
    const mockChannel = {
      watch: jest.fn().mockResolvedValue({}),
      addMembers: jest.fn().mockResolvedValue({}),
    };
    const mockClient = {
      channel: jest.fn().mockReturnValue(mockChannel),
    };
    (chatService as any).client = mockClient;
    jest.spyOn(chatService, 'ensureConnected').mockResolvedValue();
    jest.spyOn(chatService, 'getOrCreateChannel').mockImplementation(async (type, id) => ({
      channel: mockChannel as any,
      channelId: id
    }));
  });

  it('should reuse channel for same (buyer, seller, listing)', async () => {
    const params = {
      buyerId: buyer._id.toString(),
      sellerId: seller._id.toString(),
      listingId: listing1._id.toString(),
      platform: 'marketplace' as const,
      createdFrom: 'inquiry' as const
    };

    // First creation
    const res1 = await channelService.createChannel(params);
    expect(res1.channel).toBeDefined();

    const res2: any = await channelService.createChannel(params);
    expect(res2.channel._id.toString()).toBe((res1.channel as any)._id.toString());

    const count = await MarketplaceListingChannel.countDocuments({
      buyer_id: buyer._id,
      seller_id: seller._id,
      listing_id: listing1._id
    });
    expect(count).toBe(1);
  });

  it('should create DIFFERENT channels for DIFFERENT listings from same seller', async () => {
    // Channel for listing 1
    const res1 = await channelService.createChannel({
      buyerId: buyer._id.toString(),
      sellerId: seller._id.toString(),
      listingId: listing1._id.toString(),
      platform: 'marketplace',
      createdFrom: 'inquiry'
    });

    // Channel for listing 2
    const res2 = await channelService.createChannel({
      buyerId: buyer._id.toString(),
      sellerId: seller._id.toString(),
      listingId: listing2._id.toString(),
      platform: 'marketplace',
      createdFrom: 'inquiry'
    });

    expect((res1.channel as any)._id.toString()).not.toBe((res2.channel as any)._id.toString());

    const count = await MarketplaceListingChannel.countDocuments({
      buyer_id: buyer._id,
      seller_id: seller._id
    });
    expect(count).toBe(2);
  });
});
