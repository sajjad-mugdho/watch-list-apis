import request from 'supertest';
import { app } from '../../src/app';
import { TrustCase } from '../../src/models/TrustCase';
import { User } from '../../src/models/User';

describe('Trust Case Integration', () => {
    let adminUser: any;
    let regularUser: any;
    let reportedUser: any;

    beforeEach(async () => {
        await User.deleteMany({});
        // Create Admin User
        adminUser = await User.create({
            clerk_id: 'admin_clerk_tc',
            external_id: 'admin_clerk_tc',
            display_name: 'Admin TC',
            email: 'admin_tc@test.com',
            first_name: 'Admin',
            last_name: 'TC',
            isAdmin: true,
            onboarding_status: 'completed'
        });
        
        // Force isAdmin to true again to be absolutely sure
        await User.updateOne({ _id: adminUser._id }, { $set: { isAdmin: true } });

        // Create Regular User
        regularUser = await User.create({
            clerk_id: 'user_clerk_tc',
            external_id: 'user_clerk_tc',
            display_name: 'Regular TC',
            email: 'user_tc@test.com',
            first_name: 'Regular',
            last_name: 'TC',
            isAdmin: false,
            onboarding_status: 'completed'
        });

        // Create Reported User
        reportedUser = await User.create({
            clerk_id: 'reported_clerk_tc',
            external_id: 'reported_clerk_tc',
            display_name: 'Reported TC',
            email: 'reported_tc@test.com',
            first_name: 'Reported',
            last_name: 'TC',
            isAdmin: false,
            onboarding_status: 'completed'
        });

        await TrustCase.deleteMany({});
    });

    describe('POST /api/v1/admin/trust-cases (Admin Only)', () => {
        const validPayload = {
            reported_user_id: '', // Will set in test
            category: 'fraud',
            priority: 'high',
            reason: 'Consistently failing to ship items after payment.'
        };

        it('should allow admin to create a trust case', async () => {
            const res = await request(app)
                .post('/api/v1/admin/trust-cases')
                .set('x-test-user', 'admin_clerk_tc')
                .send({ ...validPayload, reported_user_id: reportedUser._id.toString() });

            expect(res.status).toBe(201);
            expect(res.body.data.reported_user_id).toBe(reportedUser._id.toString());
            expect(res.body.data.status).toBe('OPEN');
        });

        it('should forbid regular users from creating a case', async () => {
            const res = await request(app)
                .post('/api/v1/admin/trust-cases')
                .set('x-test-user', 'user_clerk_tc')
                .send({ ...validPayload, reported_user_id: reportedUser._id.toString() });

            expect(res.status).toBe(403);
        });
    });

    describe('Trust Case Workflow', () => {
        let testCase: any;

        beforeEach(async () => {
            testCase = await TrustCase.create({
                case_number: 'TC-2025-001',
                reported_user_id: reportedUser._id,
                category: 'fraud',
                priority: 'medium',
                reason: 'Initial report',
                status: 'OPEN',
                created_by: adminUser._id,
                evidence_snapshot: {
                    reported_user: {
                        _id: reportedUser._id,
                        display_name: reportedUser.display_name
                    }
                }
            });
        });

        it('should allow assigning a case to an admin', async () => {
            const res = await request(app)
                .put(`/api/v1/admin/trust-cases/${testCase._id}/assign`)
                .set('x-test-user', 'admin_clerk_tc')
                .send({ assignee_id: adminUser._id.toString() });

            expect(res.status).toBe(200);
            expect(res.body.data.assigned_to).toBe(adminUser._id.toString());
            expect(res.body.data.status).toBe('INVESTIGATING');
        });

        it('should allow escalating a case', async () => {
            const res = await request(app)
                .put(`/api/v1/admin/trust-cases/${testCase._id}/escalate`)
                .set('x-test-user', 'admin_clerk_tc')
                .send({ 
                    escalate_to_id: adminUser._id.toString(),
                    reason: 'Requires senior review' 
                });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('ESCALATED');
        });

        it('should allow resolving a case', async () => {
            const res = await request(app)
                .put(`/api/v1/admin/trust-cases/${testCase._id}/resolve`)
                .set('x-test-user', 'admin_clerk_tc')
                .send({ 
                    resolution: 'User warned about shipping delays'
                });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('RESOLVED');
        });
    });
});
