import request from 'supertest';
import { app } from '../../src/app';
import { TestFactory } from '../helpers/TestFactory';
import { User } from '../../src/models/User';
import { feedService } from '../../src/services/FeedService';

describe('Feed Routes Integration Checks', () => {
    let testUser: any;
    let testToken: string;

    beforeEach(async () => {
        testUser = await TestFactory.createMockUser({
            external_id: 'feed_test_user',
            email: 'feed_test@example.com'
        });
        testToken = 'feed_test_user';
    });

    describe('GET /api/v1/feeds/token', () => {
        it('should return a feed token', async () => {
            const res = await request(app)
                .get('/api/v1/feeds/token')
                .set('x-test-user', testToken);

            expect(res.status).toBe(200);
            expect(res.body.token).toBe('mock-feed-token');
            expect(res.body.userId).toBe(testUser._id.toString());
        });

        it('should return 401 if unauthorized', async () => {
            const res = await request(app).get('/api/v1/feeds/token');
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/feeds/timeline', () => {
        it('should return timeline activities', async () => {
            const res = await request(app)
                .get('/api/v1/feeds/timeline')
                .set('x-test-user', testToken);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.activities)).toBe(true);
        });
    });

    describe('GET /api/v1/feeds/user/:id', () => {
        it('should return activities for a specific user', async () => {
            const targetUser = await TestFactory.createMockUser({
                external_id: 'target_user',
                email: 'target@example.com'
            });

            const res = await request(app)
                .get(`/api/v1/feeds/user/${targetUser._id}`)
                .set('x-test-user', testToken);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.activities)).toBe(true);
        });

        it('should return 404 if user not found', async () => {
            const res = await request(app)
                .get('/api/v1/feeds/user/677a1111111111111111aaa1')
                .set('x-test-user', testToken);

            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/v1/feeds/following', () => {
        it('should return following list', async () => {
            const res = await request(app)
                .get('/api/v1/feeds/following')
                .set('x-test-user', testToken);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.following)).toBe(true);
        });
    });

    describe('GET /api/v1/feeds/followers', () => {
        it('should return followers list', async () => {
            const res = await request(app)
                .get('/api/v1/feeds/followers')
                .set('x-test-user', testToken);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.followers)).toBe(true);
        });
    });
});
