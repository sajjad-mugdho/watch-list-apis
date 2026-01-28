import { Types } from 'mongoose';
import { channelService } from '../../src/services/channel/ChannelService';
import { User } from '../../src/models/User';
import { NetworkListing } from '../../src/models/Listings';
import { NetworkListingChannel } from '../../src/models/ListingChannel';
import { chatService } from '../../src/services/ChatService';

describe('Networks Channels Integration', () => {
  let userA: any;
  let userB: any;
  let listing1: any;
  let listing2: any;

  beforeEach(async () => {
    // 1. Setup Data
    userA = await User.create({
      clerk_id: `userA_${Date.now()}`,
      email: `userA_${Date.now()}@test.com`,
      first_name: 'User',
      last_name: 'A',
      display_name: 'UserA'
    });

    userB = await User.create({
      clerk_id: `userB_${Date.now()}`,
      email: `userB_${Date.now()}@test.com`,
      first_name: 'User',
      last_name: 'B',
      display_name: 'UserB'
    });

    const commonListingData = {
      dialist_id: userB._id,
      clerk_id: userB.clerk_id,
      brand: 'Rolex',
      model: 'Submariner',
      price: 15000,
      status: 'active' as const,
      author: { _id: userB._id, name: 'UserB' },
      materials: 'Steel',
      bezel: 'Ceramic',
      bracelet: 'Oyster',
      diameter: '40mm',
      ships_from: { country: 'US' }
    };

    listing1 = await NetworkListing.create({
      ...commonListingData,
      watch_id: new Types.ObjectId(),
      reference: '1'
    });

    listing2 = await NetworkListing.create({
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

  it('should reuse channel for DIFFERENT listings between SAME users (Bidirectional)', async () => {
    // 1. User A inquires about User B's listing 1
    const res1 = await channelService.createChannel({
      buyerId: userA._id.toString(),
      sellerId: userB._id.toString(),
      listingId: listing1._id.toString(),
      platform: 'networks',
      createdFrom: 'inquiry'
    });

    // 2. User A inquires about User B's listing 2 (should reuse SAME channel)
    const res2 = await channelService.createChannel({
      buyerId: userA._id.toString(),
      sellerId: userB._id.toString(),
      listingId: listing2._id.toString(),
      platform: 'networks',
      createdFrom: 'inquiry'
    });

    expect((res1.channel as any)._id.toString()).toBe((res2.channel as any)._id.toString());

    // 3. User B inquires about User A's listing (if it existed) - testing participant bidirectional lookup
    // We'll just trigger it with roles swapped
    const res3 = await channelService.createChannel({
      buyerId: userB._id.toString(),
      sellerId: userA._id.toString(),
      listingId: listing1._id.toString(), // Networks requires listingId but reuses based on users
      platform: 'networks',
      createdFrom: 'inquiry'
    });

    expect((res1.channel as any)._id.toString()).toBe((res3.channel as any)._id.toString());

    const count = await NetworkListingChannel.countDocuments({
      $or: [
        { buyer_id: userA._id, seller_id: userB._id },
        { buyer_id: userB._id, seller_id: userA._id }
      ]
    });
    expect(count).toBe(1);
  });
});
