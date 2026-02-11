import request from 'supertest';
import express from 'express';
import { conversationRoutes } from '../../src/routes/conversationRoutes';
import { chatService } from '../../src/services/ChatService';
import { channelContextService } from '../../src/services/ChannelContextService';
import { User } from '../../src/models/User';
import { MarketplaceListingChannel } from '../../src/models/MarketplaceListingChannel';
import { MarketplaceListing } from '../../src/models/Listings';
import { Types } from 'mongoose';

// Setup Mock Express App
const app = express();
app.use(express.json());
// Mock auth middleware
app.use((req: any, res, next) => {
  req.auth = { userId: 'test_user_external' };
  next();
});
app.use('/api/v1/conversations', conversationRoutes);

describe('Shared Media Integration', () => {
  let user: any;
  let seller: any;
  let listing: any;
  let channel: any;

  beforeEach(async () => {
    // 1. Setup Data
    user = await User.create({
      external_id: 'test_user_external',
      clerk_id: 'clerk_123',
      email: 'test@test.com',
      first_name: 'Test',
      last_name: 'User',
      display_name: 'TestUser'
    });

    seller = await User.create({
      external_id: 'seller_external',
      clerk_id: 'clerk_456',
      email: 'seller@test.com',
      first_name: 'Seller',
      last_name: 'Two',
      display_name: 'SellerTwo'
    });

    listing = await MarketplaceListing.create({
      dialist_id: seller._id,
      clerk_id: seller.clerk_id,
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
      author: { _id: seller._id, name: 'Seller' }
    });

    channel = await MarketplaceListingChannel.create({
      buyer_id: user._id,
      seller_id: seller._id,
      listing_id: listing._id,
      platform: 'marketplace',
      status: 'open',
      getstream_channel_id: 'test_channel_cid',
      created_from: 'inquiry',
      listing_snapshot: {
        brand: 'Rolex',
        model: 'Submariner',
        reference: '126610LN',
        price: 15000
      },
      seller_snapshot: { _id: seller._id, name: 'Seller' },
      buyer_snapshot: { _id: user._id, name: 'Buyer' }
    });

    // 2. Mock ChatService Search
    jest.spyOn(chatService, 'searchMessages').mockResolvedValue({
      results: [
        {
          message: {
            id: 'msg_1',
            text: 'Here is an image',
            created_at: new Date().toISOString(),
            attachments: [
              {
                type: 'image',
                image_url: 'http://example.com/img1.jpg',
                thumb_url: 'http://example.com/thumb1.jpg',
                title: 'Image 1'
              }
            ]
          }
        },
        {
          message: {
            id: 'msg_2',
            text: 'Check this document',
            created_at: new Date().toISOString(),
            attachments: [
              {
                type: 'file',
                asset_url: 'http://example.com/doc1.pdf',
                title: 'Document 1'
              }
            ]
          }
        }
      ],
      next: 'next_token'
    });
  });

  it('should return shared media for a conversation', async () => {
    const response = await request(app)
      .get(`/api/v1/conversations/${channel._id}/media`)
      .query({ platform: 'marketplace', type: 'all' });

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(2);
    expect(response.body.data[0].type).toBe('image');
    expect(response.body.data[0].url).toBe('http://example.com/img1.jpg');
    expect(response.body.data[1].type).toBe('file');
    expect(response.body.data[1].url).toBe('http://example.com/doc1.pdf');
    expect(response.body.next).toBe('next_token');
  });

  it('should return 403 if user is not a party in the conversation', async () => {
    // Modify auth to a user who is not a party
    const unauthorizedApp = express();
    unauthorizedApp.use(express.json());
    unauthorizedApp.use((req: any, res, next) => {
      req.auth = { userId: 'other_user_external' };
      next();
    });
    // Create the other user in DB so it doesn't fail on 404
    await User.create({
      external_id: 'other_user_external',
      clerk_id: 'clerk_other',
      email: 'other@test.com',
      first_name: 'Other',
      last_name: 'User',
      display_name: 'Other'
    });

    unauthorizedApp.use('/api/v1/conversations', conversationRoutes);

    const response = await request(unauthorizedApp)
      .get(`/api/v1/conversations/${channel._id}/media`);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe('Not authorized');
  });
});
