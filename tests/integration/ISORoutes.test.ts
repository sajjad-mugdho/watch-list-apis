import request from 'supertest';
import { app } from '../../src/app';
import { TestFactory } from '../helpers/TestFactory';
import { ISO } from '../../src/models/ISO';

describe('ISO Routes', () => {
  let user: any;

  beforeEach(async () => {
    user = await TestFactory.createMockUser();
  });

  describe('POST /api/v1/isos', () => {
    it('should create a new ISO', async () => {
      const res = await request(app)
        .post('/api/v1/isos')
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id)
        .send({
          title: 'Looking for GMT Master II',
          description: 'Want a Pepsi bezel in good condition',
          urgency: 'high',
          is_public: true
        });

      if (res.status !== 201) {
        console.error('ISO Creation Failure Body:', res.body);
      }
      expect(res.body).toMatchObject({
        data: {
          title: 'Looking for GMT Master II',
          urgency: 'high'
        }
      });
      expect(res.status).toBe(201);
    });

    it('should enforce MAX_ACTIVE_ISOS limit (10)', async () => {
      // Create 10 active ISOs
      for (let i = 0; i < 10; i++) {
        await TestFactory.createISO(user._id, { status: 'active' });
      }

      const res = await request(app)
        .post('/api/v1/isos')
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id)
        .send({ title: 'ISO 11' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Maximum of 10 active ISOs allowed');
    });
  });

  describe('GET /api/v1/isos', () => {
    it('should return public active ISOs', async () => {
      await TestFactory.createISO(user._id, { is_public: true, status: 'active' });
      await TestFactory.createISO(user._id, { is_public: false, status: 'active' });
      await TestFactory.createISO(user._id, { is_public: true, status: 'fulfilled' });

      const res = await request(app)
        .get('/api/v1/isos')
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });
  });

  describe('GET /api/v1/isos/my', () => {
    it('should return current user ISOs', async () => {
      const otherUser = await TestFactory.createMockUser();
      await TestFactory.createISO(user._id, { title: 'My ISO' });
      await TestFactory.createISO(otherUser._id, { title: 'Others ISO' });

      const res = await request(app)
        .get('/api/v1/isos/my')
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('My ISO');
    });
  });

  describe('POST /api/v1/isos/:id/fulfill', () => {
    it('should mark ISO as fulfilled', async () => {
      const iso = await TestFactory.createISO(user._id, { status: 'active' });

      const res = await request(app)
        .post(`/api/v1/isos/${(iso as any)._id}/fulfill`)
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('fulfilled');
    });

    it('should not allow fulfilling others ISO', async () => {
      const otherUser = await TestFactory.createMockUser();
      const iso = await TestFactory.createISO(otherUser._id, { status: 'active' });

      const res = await request(app)
        .post(`/api/v1/isos/${(iso as any)._id}/fulfill`)
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(403);
    });
  });
});
