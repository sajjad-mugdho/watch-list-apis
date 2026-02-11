import request from 'supertest';
import { app } from '../../src/app';
import { ReservationTerms } from '../../src/models/ReservationTerms';
import { User } from '../../src/models/User';

describe('Reservation Terms Integration', () => {
    let adminUser: any;
    let regularUser: any;

    const TEST_PREFIX = 'rt_test_';
    const SUITE_ID = Math.floor(Math.random() * 1000000);

    beforeEach(async () => {
        // Only delete users created by this suite
        await User.deleteMany({ clerk_id: new RegExp(`^${TEST_PREFIX}`) });
        
        // Create Admin User
        adminUser = await User.create({
            clerk_id: `${TEST_PREFIX}admin`,
            external_id: `${TEST_PREFIX}admin`,
            email: 'admin_rev@test.com',
            first_name: 'Admin',
            last_name: 'Rev',
            isAdmin: true,
            onboarding_status: 'completed'
        });

        // Create Regular User
        regularUser = await User.create({
            clerk_id: `${TEST_PREFIX}regular`,
            external_id: `${TEST_PREFIX}regular`,
            email: 'user_rev@test.com',
            first_name: 'Regular',
            last_name: 'Rev',
            isAdmin: false,
            onboarding_status: 'completed'
        });

        await ReservationTerms.deleteMany({ version: new RegExp(`-${SUITE_ID}$`) });
    });

    describe('GET /api/v1/reservation-terms/current', () => {
        it('should return 404 if no current terms exist', async () => {
            const res = await request(app).get('/api/v1/reservation-terms/current');
            expect(res.status).toBe(404);
        });

        it('should return the current terms', async () => {
            const version = `2025.01.01-${SUITE_ID}`;
            await ReservationTerms.create({
                version,
                content: 'Current Terms Content Test',
                effective_date: new Date(),
                is_current: true,
                created_by: adminUser._id
            });

            const res = await request(app).get('/api/v1/reservation-terms/current');
            expect(res.status).toBe(200);
            expect(res.body.data.version).toBe(version);
        });
    });

    describe('POST /api/v1/reservation-terms (Admin Only)', () => {
        const version = `2025.02.11-${SUITE_ID}`;
        const validPayload = {
            version,
            content: 'Updated high-quality terms content that is long enough.',
            effective_date: new Date().toISOString(),
            set_as_current: true
        };

        it('should allow admin to create new terms', async () => {
            const res = await request(app)
                .post('/api/v1/reservation-terms')
                .set('x-test-user', `${TEST_PREFIX}admin`)
                .send(validPayload);

            expect(res.status).toBe(201);
            expect(res.body.data.version).toBe(version);

            // Verify it became current
            const current = await ReservationTerms.getCurrent();
            expect(current?.version).toBe(version);
            expect(current?.is_current).toBe(true);
        });

        it('should forbid regular users from creating terms', async () => {
            const res = await request(app)
                .post('/api/v1/reservation-terms')
                .set('x-test-user', `${TEST_PREFIX}regular`)
                .send(validPayload);

            expect(res.status).toBe(403);
        });
    });

    describe('POST /api/v1/reservation-terms/:version/archive', () => {
        it('should archive a non-current version', async () => {
            const version = `2024.12.01-${SUITE_ID}`;
            await ReservationTerms.create({
                version,
                content: 'Old Terms',
                effective_date: new Date('2024-12-01'),
                is_current: false,
                created_by: adminUser._id
            });

            const res = await request(app)
                .post(`/api/v1/reservation-terms/${version}/archive`)
                .set('x-test-user', `${TEST_PREFIX}admin`);

            expect(res.status).toBe(200);
            expect(res.body.data.is_archived).toBe(true);
        });

        it('should prevent archiving current terms', async () => {
             const version = `2025.01.01-${SUITE_ID}`;
             await ReservationTerms.create({
                version,
                content: 'Current Terms',
                content_hash: 'dummy-hash',
                effective_date: new Date(),
                is_current: true,
                created_by: adminUser._id
            });

            const res = await request(app)
                .post(`/api/v1/reservation-terms/${version}/archive`)
                .set('x-test-user', `${TEST_PREFIX}admin`);

            expect(res.status).toBe(400);
            expect(res.body.error.message).toContain('Cannot archive current terms');
        });
    });

    describe('POST /api/v1/reservation-terms/:version/set-current', () => {
        it('should allow admin to set a version as current', async () => {
            const oldVersion = `2024.11.01-${SUITE_ID}`;
            const newVersion = `2025.02.01-${SUITE_ID}`;
            await ReservationTerms.create({
                version: oldVersion,
                content: 'Old Terms',
                effective_date: new Date('2024-11-01'),
                is_current: true,
                created_by: adminUser._id
            });

            await ReservationTerms.create({
                version: newVersion,
                content: 'Newer Terms',
                effective_date: new Date('2025-02-01'),
                is_current: false,
                created_by: adminUser._id
            });

            const res = await request(app)
                .post(`/api/v1/reservation-terms/${newVersion}/set-current`)
                .set('x-test-user', `${TEST_PREFIX}admin`);

            expect(res.status).toBe(200);
            expect(res.body.data.is_current).toBe(true);

            // Verify old one is not current anymore
            const old = await ReservationTerms.getByVersion(oldVersion);
            expect(old?.is_current).toBe(false);
        });
    });
});
