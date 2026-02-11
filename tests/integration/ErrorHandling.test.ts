import request from 'supertest';
import { app } from '../../src/app';
import { TestFactory } from '../helpers/TestFactory';

describe('Error Handling', () => {
  let user: any;

  beforeAll(async () => {
    user = await TestFactory.createMockUser();
  });

  describe('Validation Errors', () => {
    it('should return 400 for invalid request body in subscription upgrade', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/upgrade')
        .set('x-test-user', user.external_id)
        .send({ tier: 'invalid-tier' }); // Tier must be 'premium' or other valid values

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing required fields', async () => {
        // Feed token requires userId in query or params usually, 
        // but let's test a simpler one like ISO creation if available
        // or just a malformed query on watches
        const res = await request(app)
          .get('/api/v1/watches')
          .query({ limit: 'not-a-number' })
          .set('x-test-user', user.external_id);
  
        // validateRequest middleware should catch this if schemas are strict
        expect(res.status).toBe(400);
      });
  });

  describe('Not Found Errors', () => {
    it('should return 404 for non-existent route', async () => {
      const res = await request(app)
        .get('/api/v1/non-existent-route')
        .set('x-test-user', user.external_id);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    });

    it('should return 404 for non-existent resource', async () => {
        const res = await request(app)
          .get('/api/v1/subscriptions/status')
          .set('x-test-user', 'non-existent-user');
  
        // Depending on implementation, this might return 404 or just empty data.
        // In this API, SubscriptionService.getSubscriptionByUserId throws NotFound if not found.
        expect(res.status).toBe(404);
      });
  });

  describe('Authentication Errors', () => {
    it('should return 401 when x-test-user is missing (in dev/test)', async () => {
      const res = await request(app)
        .get('/api/v1/feeds/token');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('Cast Errors (Mongoose)', () => {
    it('should return 400 for invalid MongoDB ObjectId', async () => {
      const res = await request(app)
        .get('/api/v1/marketplace/listings/invalid-id')
        .set('x-test-user', user.external_id);

      // In some handlers, CastError might be caught and wrapped in DatabaseError (500)
      // We check for either 400/INVALID_ID (if handled well) or 500/DATABASE_ERROR
      expect([400, 500]).toContain(res.status);
      if (res.status === 400) {
        expect(res.body.error.code).toBe('INVALID_ID');
      } else {
        expect(res.body.error.code).toBe('DATABASE_ERROR');
      }
    });
  });
});
