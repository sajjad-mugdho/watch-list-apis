import request from 'supertest';
import { app } from '../../src/app';
import { TestFactory } from '../helpers/TestFactory';
import { Subscription } from '../../src/models/Subscription';
import { User } from '../../src/models/User';
import mongoose from 'mongoose';

describe('Subscription Routes Integration Checks', () => {
    let testUser: any;
    let testToken: string;

    beforeEach(async () => {
        // Create a test user
        testUser = await TestFactory.createMockUser({
            external_id: 'sub_test_user_id',
            email: 'sub_test@example.com'
        });
        testToken = 'sub_test_user_id'; // In tests, bearer token is the external_id
    });

    describe('GET /api/v1/subscriptions/current', () => {
        it('should return current subscription and create free one if none exists', async () => {
            const res = await request(app)
                .get('/api/v1/subscriptions/current')
                .set('x-test-user', testToken);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.tier).toBe('free');
            expect(res.body.data.user_id).toBe(testUser._id.toString());
            
            // Verify it was created in DB
            const sub = await Subscription.findOne({ user_id: testUser._id });
            expect(sub).toBeDefined();
            expect(sub?.tier).toBe('free');
        });

        it('should return 401 if unauthorized', async () => {
            const res = await request(app).get('/api/v1/subscriptions/current');
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/subscriptions/tiers', () => {
        it('should return available subscription tiers', async () => {
            const res = await request(app)
                .get('/api/v1/subscriptions/tiers')
                .set('x-test-user', testToken);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
            
            const freeTier = res.body.data.find((t: any) => t.id === 'free');
            expect(freeTier).toBeDefined();
            expect(freeTier.name).toBeDefined();
        });
    });

    describe('POST /api/v1/subscriptions/upgrade', () => {
        it('should fail if tier is invalid', async () => {
            const res = await request(app)
                .post('/api/v1/subscriptions/upgrade')
                .set('x-test-user', testToken)
                .send({ tier: 'invalid_tier' });

            expect(res.status).toBe(400);
            expect(res.body.error.message).toContain('Valid tier is required');
        });

        it('should fail if upgrading to free tier', async () => {
            const res = await request(app)
                .post('/api/v1/subscriptions/upgrade')
                .set('x-test-user', testToken)
                .send({ tier: 'free' });

            expect(res.status).toBe(400);
            expect(res.body.error.message).toContain('Cannot upgrade to free tier');
        });

        it('should fail if payment_instrument_id is missing for paid tier', async () => {
            const res = await request(app)
                .post('/api/v1/subscriptions/upgrade')
                .set('x-test-user', testToken)
                .send({ tier: 'premium', billing_cycle: 'monthly' });

            expect(res.status).toBe(400);
            expect(res.body.error.message).toContain('Payment instrument ID is required');
        });

        it('should successfully upgrade to premium (mocked payment)', async () => {
            // Note: In SubscriptionRoutes.ts, if FINIX_PLATFORM_MERCHANT_ID is not set, it skips payment
            // We can rely on this for integration testing unless we want to mock createTransfer
            
            const res = await request(app)
                .post('/api/v1/subscriptions/upgrade')
                .set('x-test-user', testToken)
                .send({ 
                    tier: 'premium', 
                    billing_cycle: 'monthly',
                    payment_instrument_id: 'test_token_123' 
                });

            expect(res.status).toBe(200);
            expect(res.body.data.tier).toBe('premium');
            expect(res.body.data.status).toBe('active');
            
            const sub = await Subscription.findOne({ user_id: testUser._id });
            expect(sub?.tier).toBe('premium');
            expect(sub?.finix_instrument_id).toBe('test_token_123');
        });
    });

    describe('POST /api/v1/subscriptions/cancel', () => {
        it('should set cancel_at_period_end to true', async () => {
            // Setup: Create a premium subscription first
            await TestFactory.createSubscription(testUser._id, { tier: 'premium' });

            const res = await request(app)
                .post('/api/v1/subscriptions/cancel')
                .set('x-test-user', testToken);

            expect(res.status).toBe(200);
            expect(res.body.data.cancel_at_period_end).toBe(true);
            
            const sub = await Subscription.findOne({ user_id: testUser._id });
            expect(sub?.cancel_at_period_end).toBe(true);
            expect(sub?.cancelled_at).toBeDefined();
        });

        it('should fail for free tier', async () => {
            await TestFactory.createSubscription(testUser._id, { tier: 'free' });

            const res = await request(app)
                .post('/api/v1/subscriptions/cancel')
                .set('x-test-user', testToken);

            expect(res.status).toBe(400);
            expect(res.body.error.message).toContain('Cannot cancel free subscription');
        });
    });

    describe('PUT /api/v1/subscriptions/payment-method', () => {
        it('should update payment instrument id', async () => {
            await TestFactory.createSubscription(testUser._id, { tier: 'premium' });

            const res = await request(app)
                .put('/api/v1/subscriptions/payment-method')
                .set('x-test-user', testToken)
                .send({ payment_instrument_id: 'new_instrument_456' });

            expect(res.status).toBe(200);
            expect(res.body.data.finix_instrument_id).toBe('new_instrument_456');
            
            const sub = await Subscription.findOne({ user_id: testUser._id });
            expect(sub?.finix_instrument_id).toBe('new_instrument_456');
        });
    });
});
