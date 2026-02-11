import request from 'supertest';
import { app } from '../../src/app';
import { TestFactory } from '../helpers/TestFactory';
import { NetworkListing } from '../../src/models/Listings';
import { Watch } from '../../src/models/Watches';

describe('Listing Routes', () => {
  let user: any;

  beforeEach(async () => {
    user = await TestFactory.createMockUser();
  });

  describe('GET /api/v1/networks/listings', () => {
    it('should return a list of active network listings', async () => {
      await TestFactory.createNetworkListing(user._id, { status: 'active', brand: 'Rolex' });
      await TestFactory.createNetworkListing(user._id, { status: 'active', brand: 'Omega' });
      await TestFactory.createNetworkListing(user._id, { status: 'draft', brand: 'Tudor' });

      const res = await request(app)
        .get('/api/v1/networks/listings')
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body._metadata.paging.total).toBe(2);
    });

    it('should filter listings by brand', async () => {
      await TestFactory.createNetworkListing(user._id, { status: 'active', brand: 'Rolex' });
      await TestFactory.createNetworkListing(user._id, { status: 'active', brand: 'Omega' });

      const res = await request(app)
        .get('/api/v1/networks/listings?brand=Rolex')
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].brand).toBe('Rolex');
    });
  });

  describe('POST /api/v1/networks/listings', () => {
    it('should create a new draft listing', async () => {
      const watch = await TestFactory.createWatch({ brand: 'Cartier', model: 'Tank' });

      const res = await request(app)
        .post('/api/v1/networks/listings')
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id)
        .send({ 
          watch: (watch as any)._id.toString(),
          brand: watch.brand,
          model: watch.model,
          reference: watch.reference,
          diameter: watch.diameter,
          bezel: watch.bezel,
          materials: watch.materials,
          bracelet: watch.bracelet
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.brand).toBe('Cartier');
      expect(res.body.data.model).toBe('Tank');
    });

    it('should enforce draft limit (10)', async () => {
      const watch = await TestFactory.createWatch();
      
      // Create 10 drafts
      for (let i = 0; i < 10; i++) {
        await TestFactory.createNetworkListing(user._id, { status: 'draft' });
      }

      const res = await request(app)
        .post('/api/v1/networks/listings')
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id)
        .send({ 
          watch: (watch as any)._id.toString(),
          brand: watch.brand,
          model: watch.model,
          reference: watch.reference,
          diameter: watch.diameter,
          bezel: watch.bezel,
          materials: watch.materials,
          bracelet: watch.bracelet
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Maximum 10 draft listings allowed');
    });
  });

  describe('PATCH /api/v1/networks/listings/:id', () => {
    it('should update a draft listing', async () => {
      const listing = await TestFactory.createNetworkListing(user._id, { status: 'draft', price: 1000 });

      const res = await request(app)
        .patch(`/api/v1/networks/listings/${(listing as any)._id}`)
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id)
        .send({ price: 1200 });

      expect(res.status).toBe(200);
      expect(res.body.data.price).toBe(1200);
    });
  });

  describe('POST /api/v1/networks/listings/:id/publish', () => {
    it('should publish a draft listing', async () => {
      const listing = await TestFactory.createNetworkListing(user._id, { 
        status: 'draft',
        price: 1500000,
        condition: 'new',
        images: [
          'https://example.com/img1.jpg',
          'https://example.com/img2.jpg',
          'https://example.com/img3.jpg'
        ],
        thumbnail: 'https://example.com/thumb.jpg',
        contents: 'box_papers',
        shipping: [{ region: 'US', shippingIncluded: true, shippingCost: 0 }],
        title: 'Modern Classic'
      });

      const res = await request(app)
        .post(`/api/v1/networks/listings/${(listing as any)._id}/publish`)
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');
    });

    it('should return 400 if draft is incomplete', async () => {
      const listing = await TestFactory.createNetworkListing(user._id, { status: 'draft', price: undefined } as any);

      const res = await request(app)
        .post(`/api/v1/networks/listings/${(listing as any)._id}/publish`)
        .set('x-platform', 'networks')
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
