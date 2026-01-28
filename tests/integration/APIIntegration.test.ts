/**
 * API Integration Tests
 *
 * Comprehensive tests covering:
 * - Platform separation (Marketplace vs Networks)
 * - Channel operations
 * - Messaging
 * - Favorites with platform scoping
 * - Reference checks with order validation
 * - Current-user endpoints
 */

import { Types } from 'mongoose';
import { User } from '../../src/models/User';
import { MarketplaceListing, NetworkListing } from '../../src/models/Listings';
import { MarketplaceListingChannel } from '../../src/models/MarketplaceListingChannel';
import { NetworkListingChannel } from '../../src/models/ListingChannel';
import { Order } from '../../src/models/Order';
import { Favorite } from '../../src/models/Favorite';
import { ReferenceCheck } from '../../src/models/ReferenceCheck';
import { ISO } from '../../src/models/ISO';
import { chatService } from '../../src/services/ChatService';
import { channelService } from '../../src/services/channel/ChannelService';
import { favoriteService } from '../../src/services';

describe('Platform Separation Tests', () => {
  let userA: any;
  let userB: any;
  let marketplaceListing: any;
  let networkListing: any;

  beforeEach(async () => {
    userA = await User.create({
      external_id: `userA_${Date.now()}`,
      email: `userA_${Date.now()}@test.com`,
      first_name: 'User',
      last_name: 'A',
      display_name: 'UserA'
    });

    userB = await User.create({
      external_id: `userB_${Date.now()}`,
      email: `userB_${Date.now()}@test.com`,
      first_name: 'User',
      last_name: 'B',
      display_name: 'UserB'
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

  describe('Favorites Platform Scoping', () => {
    beforeEach(async () => {
      // Create listings for both platforms
      const { createTestMarketplaceListing, createTestNetworkListing } = require('../helpers/fixtures');
      
      marketplaceListing = await createTestMarketplaceListing({
        dialist_id: userB._id,
        external_id: userB.external_id,
        reference: 'MP-001',
      });

      networkListing = await createTestNetworkListing({
        dialist_id: userB._id,
        external_id: userB.external_id,
        reference: 'NW-001',
      });
    });

    it('should scope marketplace favorites separately from networks', async () => {
      // Add marketplace favorite
      await favoriteService.addFavorite({
        userId: userA._id.toString(),
        itemType: 'listing',
        itemId: marketplaceListing._id.toString(),
        platform: 'marketplace'
      });

      // Add networks favorite
      await favoriteService.addFavorite({
        userId: userA._id.toString(),
        itemType: 'listing',
        itemId: networkListing._id.toString(),
        platform: 'networks'
      });

      // Query marketplace favorites - should NOT include networks
      const { favorites: mpFavs } = await favoriteService.getFavorites(
        userA._id.toString(), 
        { platform: 'marketplace' }
      );

      // Query networks favorites - should NOT include marketplace
      const { favorites: nwFavs } = await favoriteService.getFavorites(
        userA._id.toString(), 
        { platform: 'networks' }
      );

      expect(mpFavs.length).toBe(1);
      expect(mpFavs[0].item_id.toString()).toBe(marketplaceListing._id.toString());

      expect(nwFavs.length).toBe(1);
      expect(nwFavs[0].item_id.toString()).toBe(networkListing._id.toString());
    });

    it('should NOT show marketplace favorites in networks query', async () => {
      await favoriteService.addFavorite({
        userId: userA._id.toString(),
        itemType: 'listing',
        itemId: marketplaceListing._id.toString(),
        platform: 'marketplace'
      });

      const { favorites } = await favoriteService.getFavorites(
        userA._id.toString(), 
        { platform: 'networks' }
      );

      expect(favorites.length).toBe(0);
    });
  });

  describe('Channel Platform Separation', () => {
    it('should create separate channels for marketplace even with same users', async () => {
      // Create marketplace listing
      const { createTestMarketplaceListing } = require('../helpers/fixtures');
      
      const mpListing1 = await createTestMarketplaceListing({
        dialist_id: userB._id,
        external_id: userB.external_id,
        reference: 'MP-002',
        price: 30000,
      });

      const mpListing2 = await createTestMarketplaceListing({
        dialist_id: userB._id,
        external_id: userB.external_id,
        reference: 'MP-003',
        price: 25000,
      });

      // Create channels for DIFFERENT listings
      const { channel: ch1 } = await channelService.createChannel({
        buyerId: userA._id.toString(),
        sellerId: userB._id.toString(),
        listingId: mpListing1._id.toString(),
        platform: 'marketplace',
        createdFrom: 'inquiry'
      });

      const { channel: ch2 } = await channelService.createChannel({
        buyerId: userA._id.toString(),
        sellerId: userB._id.toString(),
        listingId: mpListing2._id.toString(),
        platform: 'marketplace',
        createdFrom: 'inquiry'
      });

      // Marketplace: Different listings = Different channels
      expect((ch1 as any)._id.toString()).not.toBe((ch2 as any)._id.toString());
    });

    it('should reuse networks channel for same users regardless of listing', async () => {
      const { createTestNetworkListing } = require('../helpers/fixtures');
      
      const nwListing1 = await createTestNetworkListing({
        dialist_id: userB._id,
        external_id: userB.external_id,
        reference: 'NW-002',
      });

      const nwListing2 = await createTestNetworkListing({
        dialist_id: userB._id,
        external_id: userB.external_id,
        reference: 'NW-003',
      });

      // Create channels for DIFFERENT listings on Networks
      const { channel: ch1 } = await channelService.createChannel({
        buyerId: userA._id.toString(),
        sellerId: userB._id.toString(),
        listingId: nwListing1._id.toString(),
        platform: 'networks',
        createdFrom: 'inquiry'
      });

      const { channel: ch2 } = await channelService.createChannel({
        buyerId: userA._id.toString(),
        sellerId: userB._id.toString(),
        listingId: nwListing2._id.toString(),
        platform: 'networks',
        createdFrom: 'inquiry'
      });

      // Networks: Same users = Same channel (regardless of listing)
      expect((ch1 as any)._id.toString()).toBe((ch2 as any)._id.toString());
    });
  });
});

describe('Reference Check Order Requirement', () => {
  let requester: any;
  let target: any;
  let order: any;

  beforeEach(async () => {
    requester = await User.create({
      external_id: `requester_${Date.now()}`,
      email: `requester_${Date.now()}@test.com`,
      first_name: 'Requester',
      last_name: 'User',
      display_name: 'RequesterUser'
    });

    target = await User.create({
      external_id: `target_${Date.now()}`,
      email: `target_${Date.now()}@test.com`,
      first_name: 'Target',
      last_name: 'User',
      display_name: 'TargetUser'
    });

    // Create a completed order
    order = await Order.create({
      listing_id: new Types.ObjectId(),
      buyer_id: requester._id,
      seller_id: target._id,
      amount: 10000,
      currency: 'USD',
      status: 'completed',
      listing_snapshot: { brand: 'Rolex', model: 'Submariner', price: 10000 }
    });
  });

  it('should allow reference check with valid completed order', async () => {
    const refCheck = await ReferenceCheck.create({
      requester_id: requester._id,
      target_id: target._id,
      order_id: order._id,
      reason: 'Test transaction review'
    });

    expect(refCheck).toBeDefined();
    expect(refCheck.order_id?.toString()).toBe(order._id.toString());
    expect(refCheck.status).toBe('pending');
  });

  it('should validate reference check creates correct relationships', async () => {
    const refCheck = await ReferenceCheck.create({
      requester_id: requester._id,
      target_id: target._id,
      order_id: order._id,
      reason: 'Excellent transaction'
    });

    expect(refCheck.requester_id.toString()).toBe(requester._id.toString());
    expect(refCheck.target_id.toString()).toBe(target._id.toString());
  });
});

describe('Current User Endpoints', () => {
  let user: any;

  beforeEach(async () => {
    user = await User.create({
      external_id: `user_${Date.now()}`,
      email: `user_${Date.now()}@test.com`,
      first_name: 'Test',
      last_name: 'User',
      display_name: 'TestUser'
    });
  });

  describe('Favorites Isolation', () => {
    let otherUser: any;

    beforeEach(async () => {
      otherUser = await User.create({
        external_id: `other_${Date.now()}`,
        email: `other_${Date.now()}@test.com`,
        first_name: 'Other',
        last_name: 'User',
        display_name: 'OtherUser'
      });
    });

    it('should only return favorites for current user', async () => {
      const listingId1 = new Types.ObjectId().toString();
      const listingId2 = new Types.ObjectId().toString();

      // Add favorite for user
      await favoriteService.addFavorite({
        userId: user._id.toString(),
        itemType: 'listing',
        itemId: listingId1,
        platform: 'marketplace'
      });

      // Add favorite for other user
      await favoriteService.addFavorite({
        userId: otherUser._id.toString(),
        itemType: 'listing',
        itemId: listingId2,
        platform: 'marketplace'
      });

      // Query user's favorites
      const { favorites } = await favoriteService.getFavorites(
        user._id.toString(),
        { platform: 'marketplace' }
      );

      // Should only have user's favorites, not other user's
      expect(favorites.length).toBe(1);
      expect(favorites[0].item_id.toString()).toBe(listingId1);
      expect(favorites.some(f => f.item_id.toString() === listingId2)).toBe(false);
    });
  });

  describe('ISOs', () => {
    it('should return only current user ISOs', async () => {
      const otherUser = await User.create({
        external_id: `iso_other_${Date.now()}`,
        email: `iso_other_${Date.now()}@test.com`,
        first_name: 'ISO',
        last_name: 'Other',
        display_name: 'ISOOther'
      });

      // Create ISO for user
      const userIso = await ISO.create({
        user_id: user._id,
        clerk_id: user.external_id,
        title: 'User ISO',
        urgency: 'medium'
      });

      // Create ISO for other user
      await ISO.create({
        user_id: otherUser._id,
        clerk_id: (otherUser as any).external_id || `iso_other_${Date.now()}`,
        title: 'Other User ISO',
        urgency: 'high'
      });

      // Query user's ISOs
      const userIsos = await ISO.find({ user_id: user._id });

      expect(userIsos.length).toBe(1);
      expect(userIsos[0]._id.toString()).toBe(userIso._id.toString());
    });
  });
});

describe('Edge Cases', () => {
  describe('Empty Results', () => {
    let user: any;

    beforeEach(async () => {
      user = await User.create({
        external_id: `edge_${Date.now()}`,
        email: `edge_${Date.now()}@test.com`,
        first_name: 'Edge',
        last_name: 'User',
        display_name: 'EdgeUser'
      });
    });

    it('should handle empty favorites gracefully', async () => {
      const { favorites, total } = await favoriteService.getFavorites(
        user._id.toString(),
        { platform: 'marketplace' }
      );

      expect(favorites).toEqual([]);
      expect(total).toBe(0);
    });

    it('should handle empty channels gracefully', async () => {
      const channels = await channelService.getChannelsForUser({
        userId: user._id.toString(),
        platform: 'marketplace'
      });

      expect(channels).toEqual([]);
    });
  });

  describe('Pagination', () => {
    let user: any;

    beforeEach(async () => {
      user = await User.create({
        external_id: `page_${Date.now()}`,
        email: `page_${Date.now()}@test.com`,
        first_name: 'Page',
        last_name: 'User',
        display_name: 'PageUser'
      });

      // Create multiple favorites
      for (let i = 0; i < 25; i++) {
        await favoriteService.addFavorite({
          userId: user._id.toString(),
          itemType: 'listing',
          itemId: new Types.ObjectId().toString(),
          platform: 'marketplace'
        });
      }
    });

    it('should paginate results correctly', async () => {
      const { favorites: page1 } = await favoriteService.getFavorites(
        user._id.toString(),
        { platform: 'marketplace', limit: 10, offset: 0 }
      );

      const { favorites: page2 } = await favoriteService.getFavorites(
        user._id.toString(),
        { platform: 'marketplace', limit: 10, offset: 10 }
      );

      const { favorites: page3 } = await favoriteService.getFavorites(
        user._id.toString(),
        { platform: 'marketplace', limit: 10, offset: 20 }
      );

      expect(page1.length).toBe(10);
      expect(page2.length).toBe(10);
      expect(page3.length).toBe(5);

      // Ensure no overlap
      const allIds = [...page1, ...page2, ...page3].map(f => f._id.toString());
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(25);
    });
  });
});
