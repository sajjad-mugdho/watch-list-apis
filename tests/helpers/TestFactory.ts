import { Types } from 'mongoose';
import { User, IUser } from '../../src/models/User';
import { Watch, IWatch } from '../../src/models/Watches';
import { MarketplaceListing, NetworkListing, IMarketplaceListing, INetworkListing } from '../../src/models/Listings';
import { Subscription, ISubscription } from '../../src/models/Subscription';
import { ISO, IISO } from '../../src/models/ISO';
import { Order, IOrder } from '../../src/models/Order';

/**
 * TestFactory
 * 
 * Centralized utility for generating mock data for integration/E2E tests.
 */
export class TestFactory {
  /**
   * Create a mock user in the database
   */
  static async createMockUser(overrides: Partial<IUser> = {}): Promise<IUser> {
    const defaultUser = {
      external_id: `user_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      first_name: 'Test',
      last_name: 'User',
      email: `test_${Date.now()}@example.com`,
      location: {
        country: 'US',
        region: 'California',
        postal_code: '94102',
      },
      display_name: overrides.display_name || 'Test User',
      onboarding: {
        status: 'completed',
        version: '1.0',
        steps: {
          location: {
            country: 'US',
            postal_code: '94102',
            region: 'California',
            updated_at: new Date(),
          },
          display_name: {
            confirmed: true,
            value: 'Test User',
            user_provided: true,
            updated_at: new Date(),
          },
          avatar: {
            confirmed: true,
            url: 'https://example.com/avatar.jpg',
            user_provided: true,
            updated_at: new Date(),
          },
          acknowledgements: {
            tos: true,
            privacy: true,
            rules: true,
            updated_at: new Date(),
          },
        },
      },
      ...overrides,
    };

    return await User.create(defaultUser);
  }

  /**
   * Create a mock Marketplace Listing
   */
  static async createMarketplaceListing(userId: string | Types.ObjectId, overrides: Partial<IMarketplaceListing> = {}): Promise<IMarketplaceListing> {
    const dialist_id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    
    const defaultListing = {
      dialist_id,
      clerk_id: overrides.clerk_id || `clerk_${dialist_id}`,
      watch_id: new Types.ObjectId(),
      status: 'active',
      brand: 'Rolex',
      model: 'Submariner',
      reference: '126610LN',
      diameter: '41mm',
      bezel: 'Ceramic',
      materials: 'Steel',
      bracelet: 'Oyster',
      price: 1500000, // $15,000.00
      condition: 'new',
      author: {
        _id: dialist_id,
        name: 'Test User',
      },
      ships_from: { country: 'US', region: 'California' },
      watch_snapshot: {
        brand: 'Rolex',
        model: 'Submariner',
        reference: '126610LN',
        diameter: '41mm',
        bezel: 'Ceramic',
        materials: 'Steel',
        bracelet: 'Oyster',
      },
      images: ['https://example.com/img1.jpg'],
      thumbnail: 'https://example.com/thumb.jpg',
      ...overrides,
    };

    return await MarketplaceListing.create(defaultListing);
  }

  /**
   * Create a mock Subscription
   */
  static async createSubscription(userId: string | Types.ObjectId, overrides: Partial<ISubscription> = {}): Promise<ISubscription> {
    const dialist_id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const defaultSubscription = {
      user_id: dialist_id,
      clerk_id: overrides.clerk_id || `clerk_${dialist_id}`,
      tier: 'free',
      status: 'active',
      price_cents: 0,
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ...overrides,
    };

    return await Subscription.create(defaultSubscription);
  }

  /**
   * Create a mock Watch
   */
  static async createWatch(overrides: Partial<IWatch> = {}): Promise<IWatch> {
    const defaultWatch = {
      brand: 'Rolex',
      model: 'Submariner',
      reference: '126610LN',
      diameter: '41mm',
      bezel: 'Ceramic',
      materials: 'Steel',
      bracelet: 'Oyster',
      category: 'Luxury',
      ...overrides,
    };

    return await Watch.create(defaultWatch);
  }

  /**
   * Create a mock Network Listing
   */
  static async createNetworkListing(userId: string | Types.ObjectId, overrides: Partial<INetworkListing> = {}): Promise<INetworkListing> {
    const dialist_id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    
    const defaultListing = {
      dialist_id,
      clerk_id: overrides.clerk_id || `clerk_${dialist_id}`,
      watch_id: new Types.ObjectId(),
      status: 'active',
      brand: 'Rolex',
      model: 'Submariner',
      reference: '126610LN',
      diameter: '41mm',
      bezel: 'Ceramic',
      materials: 'Steel',
      bracelet: 'Oyster',
      price: 1500000,
      condition: 'new',
      author: {
        _id: dialist_id,
        name: 'Test User',
      },
      ships_from: { country: 'US' },
      ...overrides,
    };

    return await NetworkListing.create(defaultListing);
  }

  /**
   * Create a mock ISO
   */
  static async createISO(userId: string | Types.ObjectId, overrides: Partial<IISO> = {}): Promise<IISO> {
    const dialist_id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    
    const defaultISO = {
      user_id: dialist_id,
      clerk_id: overrides.clerk_id || `clerk_${dialist_id}`,
      title: 'Looking for GMT Master II',
      status: 'active',
      urgency: 'medium',
      is_public: true,
      ...overrides,
    };

    return await ISO.create(defaultISO);
  }

  /**
   * Create a mock Order
   */
  static async createOrder(buyerId: string | Types.ObjectId, sellerId: string | Types.ObjectId, overrides: Partial<IOrder> = {}): Promise<IOrder> {
    const buyer_id = typeof buyerId === 'string' ? new Types.ObjectId(buyerId) : buyerId;
    const seller_id = typeof sellerId === 'string' ? new Types.ObjectId(sellerId) : sellerId;
    
    const defaultOrder = {
      listing_id: new Types.ObjectId(),
      buyer_id,
      seller_id,
      amount: 1500000,
      currency: 'USD',
      status: 'reserved',
      listing_snapshot: {
        brand: 'Rolex',
        model: 'Submariner',
        price: 1500000,
      },
      ...overrides,
    };

    return await Order.create(defaultOrder);
  }
}
