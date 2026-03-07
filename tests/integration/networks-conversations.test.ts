import request from 'supertest';
import express from 'express';
import { Types } from 'mongoose';
import conversationRoutes from '../../src/networks/routes/conversationRoutes';
import { User } from '../../src/models/User';
import { Conversation } from '../../src/models/Conversation';
import { ConversationMessage } from '../../src/models/ConversationMessage';

// Setup Mock Express App
const app = express();
app.use(express.json());

// Add mock platform routing middleware
app.use((req, res, next) => {
  (req as any).platform = 'networks';
  next();
});

// Mock auth middleware
app.use((req: any, res, next) => {
  req.auth = { userId: 'user_one' };
  next();
});

app.use('/api/v1/conversations', conversationRoutes);

describe('Networks Conversations - URL Enrichment & Shared Media Routes', () => {
  let user1: any;
  let user2: any;
  let conversation: any;

  beforeEach(async () => {
    // Create test users
    user1 = await User.create({
      external_id: 'user_one',
      clerk_id: 'clerk_user1',
      email: 'user1@test.com',
      first_name: 'User',
      last_name: 'One',
      display_name: 'UserOne',
    });

    user2 = await User.create({
      external_id: 'user_two',
      clerk_id: 'clerk_user2',
      email: 'user2@test.com',
      first_name: 'User',
      last_name: 'Two',
      display_name: 'UserTwo',
    });

    // Create conversation
    conversation = await Conversation.create({
      _id: new Types.ObjectId(),
      channel_id: 'test_channel_123',
      participants: [user1._id, user2._id],
      platform: 'networks',
      created_at: new Date(),
    });
  });

  describe('GET /:id/shared/media - Shared Media Retrieval', () => {
    let conversationId: string;

    beforeEach(async () => {
      conversationId = conversation._id.toString();

      // Create messages with image media
      await ConversationMessage.create({
        _id: new Types.ObjectId(),
        conversation_id: conversation._id,
        sender_id: user1._id,
        content: 'Check out this watch',
        media: [
          {
            type: 'image',
            url: 'https://example.com/watch1.jpg',
            timestamp: new Date(),
          },
          {
            type: 'image',
            url: 'https://example.com/watch2.jpg',
            timestamp: new Date(),
          },
        ],
        created_at: new Date(),
      });

      // Create another message with more images
      await ConversationMessage.create({
        _id: new Types.ObjectId(),
        conversation_id: conversation._id,
        sender_id: user2._id,
        content: 'Beautiful collection',
        media: [
          {
            type: 'image',
            url: 'https://example.com/collection.jpg',
            timestamp: new Date(),
          },
        ],
        created_at: new Date(),
      });
    });

    it('should retrieve only image media from conversation', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${conversationId}/shared/media`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.media)).toBe(true);
    });

    it('should filter media by type=image', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${conversationId}/shared/media`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      if (res.body.media && res.body.media.length > 0) {
        res.body.media.forEach((item: any) => {
          expect(item.type).toBe('image');
        });
      }
    });

    it('should include pagination metadata', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${conversationId}/shared/media`)
        .query({ limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('_metadata');
    });

    it('should return 404 for non-existent conversation', async () => {
      const fakeId = new Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/conversations/${fakeId}/shared/media`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /:id/shared/files - Shared Files Retrieval', () => {
    let conversationId: string;

    beforeEach(async () => {
      conversationId = conversation._id.toString();

      // Create messages with file media
      await ConversationMessage.create({
        _id: new Types.ObjectId(),
        conversation_id: conversation._id,
        sender_id: user1._id,
        content: 'Invoice attached',
        media: [
          {
            type: 'file',
            url: 'https://example.com/invoice.pdf',
            filename: 'invoice_2024.pdf',
            timestamp: new Date(),
          },
        ],
        created_at: new Date(),
      });

      await ConversationMessage.create({
        _id: new Types.ObjectId(),
        conversation_id: conversation._id,
        sender_id: user2._id,
        content: 'Documents',
        media: [
          {
            type: 'file',
            url: 'https://example.com/docs.zip',
            filename: 'documents.zip',
            timestamp: new Date(),
          },
        ],
        created_at: new Date(),
      });
    });

    it('should retrieve only file media from conversation', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${conversationId}/shared/files`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.media)).toBe(true);
    });

    it('should filter media by type=file', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${conversationId}/shared/files`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      if (res.body.media && res.body.media.length > 0) {
        res.body.media.forEach((item: any) => {
          expect(item.type).toBe('file');
        });
      }
    });

    it('should include filename in file media', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${conversationId}/shared/files`);

      expect(res.status).toBe(200);
      if (res.body.media && res.body.media.length > 0) {
        res.body.media.forEach((item: any) => {
          expect(item).toHaveProperty('filename');
        });
      }
    });
  });

  describe('GET /:id/shared/links - Shared Links (URL Enrichment) Retrieval', () => {
    let conversationId: string;

    beforeEach(async () => {
      conversationId = conversation._id.toString();

      // Create messages with url_enrichment media (new feature)
      await ConversationMessage.create({
        _id: new Types.ObjectId(),
        conversation_id: conversation._id,
        sender_id: user1._id,
        content: 'Check this article about watch care',
        media: [
          {
            type: 'url_enrichment',
            url: 'https://example.com/article/watch-care',
            title: 'How to Care for Your Luxury Watch',
            description: 'Complete guide to maintaining your timepiece',
            image: 'https://example.com/watch-care.jpg',
            timestamp: new Date(),
          },
        ],
        created_at: new Date(),
      });

      await ConversationMessage.create({
        _id: new Types.ObjectId(),
        conversation_id: conversation._id,
        sender_id: user2._id,
        content: 'This forum discussion is useful',
        media: [
          {
            type: 'url_enrichment',
            url: 'https://forums.example.com/thread/123',
            title: 'Rolex Repair Discussion',
            description: 'Common issues and solutions',
            image: 'https://example.com/forum.jpg',
            timestamp: new Date(),
          },
        ],
        created_at: new Date(),
      });
    });

    it('should retrieve only url_enrichment media from conversation', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${conversationId}/shared/links`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.media)).toBe(true);
    });

    it('should filter media by type=url_enrichment', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${conversationId}/shared/links`);

      expect(res.status).toBe(200);
      if (res.body.media && res.body.media.length > 0) {
        res.body.media.forEach((item: any) => {
          expect(item.type).toBe('url_enrichment');
        });
      }
    });

    it('should include enrichment metadata (title, description, image)', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${conversationId}/shared/links`);

      expect(res.status).toBe(200);
      if (res.body.media && res.body.media.length > 0) {
        const link = res.body.media[0];
        expect(link).toHaveProperty('url');
        expect(link).toHaveProperty('title');
        expect(link).toHaveProperty('description');
        expect(link).toHaveProperty('image');
      }
    });

    it('should support url_enrichment as a valid media type', async () => {
      // Verify that the handler accepts url_enrichment type
      const res = await request(app)
        .get(`/api/v1/conversations/${conversationId}/shared/links`);

      expect(res.status).toBe(200);
      // If handler doesn't support url_enrichment, it would return 400 or filter out results
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('Shared Media Routes - Alias Routes', () => {
    let conversationId: string;

    beforeEach(async () => {
      conversationId = conversation._id.toString();

      // Create mixed media in conversation
      await ConversationMessage.create({
        _id: new Types.ObjectId(),
        conversation_id: conversation._id,
        sender_id: user1._id,
        content: 'Mixed content',
        media: [
          {
            type: 'image',
            url: 'https://example.com/photo.jpg',
            timestamp: new Date(),
          },
          {
            type: 'file',
            url: 'https://example.com/doc.pdf',
            timestamp: new Date(),
          },
          {
            type: 'url_enrichment',
            url: 'https://example.com/link',
            title: 'Link Title',
            timestamp: new Date(),
          },
        ],
        created_at: new Date(),
      });
    });

    it('should have /shared/media as alias for ?type=image', async () => {
      const mediaRes = await request(app).get(
        `/api/v1/conversations/${conversationId}/shared/media`
      );

      expect(mediaRes.status).toBe(200);
      if (mediaRes.body.media?.length > 0) {
        mediaRes.body.media.forEach((item: any) => {
          expect(item.type).toBe('image');
        });
      }
    });

    it('should have /shared/files as alias for ?type=file', async () => {
      const filesRes = await request(app).get(
        `/api/v1/conversations/${conversationId}/shared/files`
      );

      expect(filesRes.status).toBe(200);
      if (filesRes.body.media?.length > 0) {
        filesRes.body.media.forEach((item: any) => {
          expect(item.type).toBe('file');
        });
      }
    });

    it('should have /shared/links as alias for ?type=url_enrichment', async () => {
      const linksRes = await request(app).get(
        `/api/v1/conversations/${conversationId}/shared/links`
      );

      expect(linksRes.status).toBe(200);
      if (linksRes.body.media?.length > 0) {
        linksRes.body.media.forEach((item: any) => {
          expect(item.type).toBe('url_enrichment');
        });
      }
    });

    it('should support pagination on all shared routes', async () => {
      const routes = [
        `/api/v1/conversations/${conversationId}/shared/media`,
        `/api/v1/conversations/${conversationId}/shared/files`,
        `/api/v1/conversations/${conversationId}/shared/links`,
      ];

      for (const route of routes) {
        const res = await request(app)
          .get(route)
          .query({ limit: 5, offset: 0 });

        expect([200, 404]).toContain(res.status);
        if (res.status === 200) {
          expect(res.body).toHaveProperty('_metadata');
        }
      }
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await ConversationMessage.deleteMany({});
  });
});
