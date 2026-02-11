import request from 'supertest';
import { app } from '../../src/app';
import { Watch } from '../../src/models/Watches';
import { TestFactory } from '../helpers/TestFactory';

describe('Watches Routes', () => {
  let user: any;

  beforeAll(async () => {
    user = await TestFactory.createMockUser();
  });

  beforeEach(async () => {
    await Watch.deleteMany({});
  });

  describe('GET /api/v1/watches', () => {
    it('should return a list of watches with default pagination', async () => {
      // Create some watches
      await TestFactory.createWatch({ brand: 'Rolex', model: 'Submariner' });
      await TestFactory.createWatch({ brand: 'Omega', model: 'Speedmaster' });

      const res = await request(app)
        .get('/api/v1/watches')
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body._metadata.total).toBe(2);
      expect(res.body._metadata.pagination.limit).toBe(10);
    });

    it('should filter watches by category', async () => {
      await TestFactory.createWatch({ brand: 'Rolex', category: 'Luxury' });
      await TestFactory.createWatch({ brand: 'Casio', category: 'Casual' });

      const res = await request(app)
        .get('/api/v1/watches')
        .query({ category: 'Luxury' })
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].brand).toBe('Rolex');
    });

    it('should search watches by query (regex fallback)', async () => {
      await TestFactory.createWatch({ brand: 'Rolex', model: 'Submariner' });
      await TestFactory.createWatch({ brand: 'Omega', model: 'Speedmaster' });

      const res = await request(app)
        .get('/api/v1/watches')
        .query({ q: 'omega' })
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].brand).toBe('Omega');
    });

    it('should search with category filter combined', async () => {
      await TestFactory.createWatch({ brand: 'Rolex', model: 'Submariner', category: 'Luxury' });
      await TestFactory.createWatch({ brand: 'Rolex', model: 'Explorer', category: 'Sport' });

      const res = await request(app)
        .get('/api/v1/watches')
        .query({ q: 'rolex', category: 'Sport' })
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].model).toBe('Explorer');
    });

    it('should handle pagination (limit and offset)', async () => {
      for (let i = 0; i < 5; i++) {
        await TestFactory.createWatch({ reference: `REF-${i}` });
      }

      const res = await request(app)
        .get('/api/v1/watches')
        .query({ limit: 2, offset: 2 })
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body._metadata.pagination.offset).toBe(2);
      expect(res.body._metadata.pagination.limit).toBe(2);
      expect(res.body._metadata.pagination.hasMore).toBe(true);
    });

    it('should return empty list when no matches found', async () => {
      const res = await request(app)
        .get('/api/v1/watches')
        .query({ q: 'non-existent' })
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body._metadata.total).toBe(0);
    });

    it('should sort watches by random', async () => {
      await TestFactory.createWatch({ brand: 'A' });
      await TestFactory.createWatch({ brand: 'B' });
      await TestFactory.createWatch({ brand: 'C' });

      const res = await request(app)
        .get('/api/v1/watches')
        .query({ sort: 'random', limit: 3 })
        .set('x-test-user', user.external_id);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body._metadata.sort).toBe('random');
      // "random" sampler doesn't guarantee a different order every time in small datasets, 
      // but we verify the API handles the parameter correctly.
    });
  });
});
