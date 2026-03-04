import request from 'supertest';
import express from 'express';
import networksReferenceCheckRoutes from "../../src/networks/routes/referenceCheckRoutes";
import { User } from '../../src/models/User';
import { ReferenceCheck } from '../../src/models/ReferenceCheck';
import { Vouch } from '../../src/models/Vouch';
import { Order } from '../../src/models/Order';
import { Types } from 'mongoose';

import { events } from '../../src/utils/events';
import { Notification } from '../../src/models/Notification';
import { feedService } from '../../src/services/FeedService';
import { auditService } from '../../src/services/AuditService';

import { MarketplaceListing } from '../../src/models/Listings';
import { Friendship } from '../../src/models/Friendship';

// Mock auth middleware for different users
const mockAuth = (userId: string) => (req: any, res: any, next: any) => {
  req.auth = { userId };
  next();
};

const createApp = (userId: string) => {
  const app = express();
  app.use(express.json());
  app.use(mockAuth(userId));
  // Add mock networks platform routing middleware
  app.use((req, res, next) => {
    (req as any).platform = 'networks';
    next();
  });
  app.use('/api/v1/reference-checks', networksReferenceCheckRoutes);
  return app;
};

describe('Load Burst Integration', () => {
  let buyer: any;
  let seller: any;
  let order: any;
  let listing: any;
  let refCheck: any;

  beforeEach(async () => {
    // Setup basic data
    buyer = await User.create({
      external_id: 'buyer_ext',
      clerk_id: 'clerk_buyer',
      email: 'buyer@test.com',
      display_name: 'Buyer',
      first_name: 'Buyer',
      last_name: 'User'
    });

    seller = await User.create({
      external_id: 'seller_ext',
      clerk_id: 'clerk_seller',
      email: 'seller@test.com',
      display_name: 'Seller',
      first_name: 'Seller',
      last_name: 'User'
    });

    listing = await MarketplaceListing.create({
      dialist_id: seller._id,
      clerk_id: seller.clerk_id,
      watch_id: new Types.ObjectId(),
      brand: 'Rolex',
      model: 'Sub',
      reference: '126610LN',
      diameter: '40mm',
      bezel: 'Ceramic',
      materials: 'Steel',
      bracelet: 'Oyster',
      price: 10000,
      status: 'active',
      author: { _id: seller._id, name: 'Seller' },
      ships_from: { country: 'US' },
      watch_snapshot: { 
        brand: 'Rolex', 
        model: 'Sub',
        reference: '126610LN',
        diameter: '40mm',
        bezel: 'Ceramic',
        materials: 'Steel',
        bracelet: 'Oyster',
      }
    });

    order = await Order.create({
      buyer_id: buyer._id,
      seller_id: seller._id,
      listing_id: listing._id,
      amount: 10000,
      currency: 'USD',
      status: 'completed',
      listing_snapshot: { 
        brand: 'Rolex', 
        model: 'Sub', 
        reference: '126610LN',
        price: 10000 
      },
      seller_snapshot: { 
        _id: seller._id, 
        name: 'Seller',
        display_name: 'Seller',
        email: 'seller@test.com'
      },
      buyer_snapshot: { 
        _id: buyer._id, 
        name: 'Buyer',
        display_name: 'Buyer',
        email: 'buyer@test.com'
      }
    });

    refCheck = await ReferenceCheck.create({
      requester_id: buyer._id,
      target_id: seller._id,
      order_id: order._id,
      status: 'pending',
      listing_snapshot: { 
        brand: 'Rolex', 
        model: 'Sub', 
        reference: '126610LN',
        price: 10000 
      }
    });
  });

  it('should handle a burst of vouches from DIFFERENT users for the same check', async () => {
    const numVouchers = 10;
    const vouchers = [];

    // Create 10 vouchers and establish friendships
    for (let i = 0; i < numVouchers; i++) {
      const voucher = await User.create({
        external_id: `voucher_ext_${i}`,
        clerk_id: `clerk_voucher_${i}`,
        email: `voucher${i}@test.com`,
        display_name: `Voucher ${i}`,
        first_name: `Voucher`,
        last_name: `${i}`
      });
      vouchers.push(voucher);

      // Must be connected to vouch
      await Friendship.create({
        requester_id: voucher._id,
        addressee_id: seller._id,
        status: 'accepted'
      });
      await Friendship.create({
        requester_id: seller._id,
        addressee_id: voucher._id,
        status: 'accepted'
      });
    }

    // Trigger concurrent requests
    const requests = vouchers.map(v => 
      request(createApp(v.external_id as string))
        .post(`/api/v1/reference-checks/${refCheck._id}/vouch`)
        .send({ vouch_for_user_id: seller._id.toString(), comment: 'Great seller!' })
    );

    const results = await Promise.all(requests);

    // Assert all succeeded (or some rejected if rate limited globally, but it's per user)
    const successCount = results.filter(r => r.status === 201).length;
    expect(successCount).toBe(numVouchers);

    // Verify DB
    const vouchCount = await Vouch.countDocuments({ reference_check_id: refCheck._id });
    expect(vouchCount).toBe(numVouchers);
  });

  it('should prevent double-vouching from the SAME user in a race condition', async () => {
    const voucher = await User.create({
      external_id: 'single_voucher_ext',
      clerk_id: 'clerk_single_voucher',
      email: 'single@test.com',
      display_name: 'SingleVoucher',
      first_name: 'Single',
      last_name: 'Voucher'
    });

    await Friendship.create({
      requester_id: voucher._id,
      addressee_id: seller._id,
      status: 'accepted'
    });
    await Friendship.create({
      requester_id: seller._id,
      addressee_id: voucher._id,
      status: 'accepted'
    });

    const app = createApp(voucher.external_id as string);

    // Trigger two concurrent requests from the same user
    const results = await Promise.allSettled([
      request(app).post(`/api/v1/reference-checks/${refCheck._id}/vouch`).send({ vouch_for_user_id: seller._id.toString() }),
      request(app).post(`/api/v1/reference-checks/${refCheck._id}/vouch`).send({ vouch_for_user_id: seller._id.toString() })
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled') as any[];
    
    // At least one should succeed (if they didn't both fail due to immediate lock competition)
    // and definitely NO more than one should succeed with 201.
    const statuses = fulfilled.map(r => r.value.status);
    const createdCount = statuses.filter(s => s === 201).length;
    
    // Unique index should catch the second one
    expect(createdCount).toBeLessThanOrEqual(1);

    const vouchCount = await Vouch.countDocuments({ 
        reference_check_id: refCheck._id, 
        vouched_by_user_id: voucher._id 
    });
    expect(vouchCount).toBeLessThanOrEqual(1);
  });

  it('should enforce per-user hourly rate limits', async () => {
    const voucher = await User.create({
      external_id: 'rate_limit_ext',
      clerk_id: 'clerk_rate_limit',
      email: 'ratelimit@test.com',
      display_name: 'RateLimitUser',
      first_name: 'Rate',
      last_name: 'Limit'
    });

    // Create 6 different reference checks (MAX is 5 per hour)
    const checks = [];
    for (let i = 0; i < 6; i++) {
      const target = await User.create({
        external_id: `target_ext_${i}`,
        clerk_id: `clerk_target_${i}`,
        email: `target${i}@test.com`,
        display_name: `Target ${i}`,
        first_name: `Target`,
        last_name: `${i}`
      });

      await Friendship.create({ requester_id: voucher._id, addressee_id: target._id, status: 'accepted' });
      await Friendship.create({ requester_id: target._id, addressee_id: voucher._id, status: 'accepted' });

      const check = await ReferenceCheck.create({
        requester_id: buyer._id,
        target_id: target._id,
        status: 'pending',
        listing_snapshot: { 
          brand: 'Rolex', 
          model: 'Sub', 
          reference: '126610LN',
          price: 10000 
        }
      });
      checks.push(check);
    }

    const app = createApp(voucher.external_id as string);

    // Try to vouch 6 times
    const results = [];
    for (const check of checks) {
      const res = await request(app)
        .post(`/api/v1/reference-checks/${check._id}/vouch`)
        .send({ vouch_for_user_id: check.target_id.toString() });
      results.push(res);
    }

    const successCount = results.filter(r => r.status === 201).length;
    // Rate limit can be triggered by either middleware (429) or service (400)
    const rateLimitedCount = results.filter(r => 
        (r.status === 429 && r.body.error.code === 'RATE_LIMIT_EXCEEDED') ||
        (r.status === 400 && r.body.error.message.includes('Rate limit'))
    ).length;

    expect(successCount).toBe(5);
    expect(rateLimitedCount).toBe(1);
  });
});
