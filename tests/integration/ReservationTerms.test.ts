import request from 'supertest';
import { app } from '../../src/app';
import { ReservationTerms } from '../../src/models/ReservationTerms';
import { User } from '../../src/models/User';

describe('Reservation Terms Integration', () => {
    let adminUser: any;
    let regularUser: any;

    beforeEach(async () => {
        await User.deleteMany({});
        // Create Admin User
        adminUser = await User.create({
            clerk_id: 'admin_clerk_rev',
            external_id: 'admin_clerk_rev',
            email: 'admin_rev@test.com',
            first_name: 'Admin',
            last_name: 'Rev',
            isAdmin: true,
            onboarding_status: 'completed'
        });

        // Create Regular User
        regularUser = await User.create({
            clerk_id: 'user_clerk_rev',
            external_id: 'user_clerk_rev',
            email: 'user_rev@test.com',
            first_name: 'Regular',
            last_name: 'Rev',
            isAdmin: false,
            onboarding_status: 'completed'
        });

        await ReservationTerms.deleteMany({});
    });

    describe('GET /api/v1/reservation-terms/current', () => {
        it('should return 404 if no current terms exist', async () => {
            const res = await request(app).get('/api/v1/reservation-terms/current');
            expect(res.status).toBe(404);
        });

        it('should return the current terms', async () => {
            await ReservationTerms.create({
                version: '2025.01.01',
                content: 'Current Terms Content Test',
                effective_date: new Date(),
                is_current: true,
                created_by: adminUser._id
            });

            const res = await request(app).get('/api/v1/reservation-terms/current');
            expect(res.status).toBe(200);
            expect(res.body.data.version).toBe('2025.01.01');
        });
    });

    describe('POST /api/v1/reservation-terms (Admin Only)', () => {
        const validPayload = {
            version: '2025.02.11',
            content: 'Updated high-quality terms content that is long enough.',
            effective_date: new Date().toISOString(),
            set_as_current: true
        };

        it('should allow admin to create new terms', async () => {
            const res = await request(app)
                .post('/api/v1/reservation-terms')
                .set('x-test-user', 'admin_clerk_rev')
                .send(validPayload);

            expect(res.status).toBe(201);
            expect(res.body.data.version).toBe('2025.02.11');

            // Verify it became current
            const current = await ReservationTerms.getCurrent();
            expect(current?.version).toBe('2025.02.11');
            expect(current?.is_current).toBe(true);
        });

        it('should forbid regular users from creating terms', async () => {
            const res = await request(app)
                .post('/api/v1/reservation-terms')
                .set('x-test-user', 'user_clerk_rev')
                .send(validPayload);

            expect(res.status).toBe(403);
        });
    });

    describe('POST /api/v1/reservation-terms/:version/archive', () => {
        it('should archive a non-current version', async () => {
            await ReservationTerms.create({
                version: '2024.12.01',
                content: 'Old Terms',
                effective_date: new Date('2024-12-01'),
                is_current: false,
                created_by: adminUser._id
            });

            const res = await request(app)
                .post('/api/v1/reservation-terms/2024.12.01/archive')
                .set('x-test-user', 'admin_clerk_rev');

            expect(res.status).toBe(200);
            expect(res.body.data.is_archived).toBe(true);
        });

        it('should prevent archiving current terms', async () => {
             await ReservationTerms.create({
                version: '2025.01.01',
                content: 'Current Terms',
                content_hash: 'dummy-hash',
                effective_date: new Date(),
                is_current: true,
                created_by: adminUser._id
            });

            const res = await request(app)
                .post('/api/v1/reservation-terms/2025.01.01/archive')
                .set('x-test-user', 'admin_clerk_rev');

            expect(res.status).toBe(400);
            expect(res.body.error.message).toContain('Cannot archive current terms');
        });
    });
});
