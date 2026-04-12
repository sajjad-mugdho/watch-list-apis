import request from 'supertest';
import { app } from '../../src/app';
import { GetstreamWebhookEvent } from '../../src/models/GetstreamWebhookEvent';
import { WebhookEvent } from '../../src/models/WebhookEvent';
import { chatService } from '../../src/services/ChatService';

describe('GetStream Webhook Integration Checks', () => {
    const mockPayload = {
        type: 'message.new',
        message: {
            id: 'msg-123',
            text: 'Hello world',
            user: { id: 'user-123' }
        },
        cid: 'messaging:channel-123'
    };

    const mockHeaders = {
        'x-signature': 'valid-sig',
        'x-webhook-id': 'evt-123',
        'x-webhook-attempt': '1'
    };

    beforeEach(async () => {
        await GetstreamWebhookEvent.deleteMany({});
        await WebhookEvent.deleteMany({});
        
        // Mock verifyWebhook to return true by default
        jest.spyOn(chatService.getClient(), 'verifyWebhook').mockReturnValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('POST /api/v1/webhooks/getstream', () => {
        it('should successfully receive and enqueue a webhook', async () => {
            const res = await request(app)
                .post('/api/v1/webhooks/getstream')
                .set(mockHeaders)
                .send(mockPayload);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.eventId).toBe('evt-123');

            // Verify persistence
            const gsEvent = await GetstreamWebhookEvent.findOne({ eventId: 'evt-123' });
            expect(gsEvent).toBeDefined();
            expect(gsEvent?.eventType).toBe('message.new');
            expect(gsEvent?.status).toBe('pending');

            const whEvent = await WebhookEvent.findOne({ eventId: 'evt-123' });
            expect(whEvent).toBeDefined();
            expect(whEvent?.provider).toBe('getstream');
        });

        it('should return 401 for invalid signature', async () => {
            jest.spyOn(chatService.getClient(), 'verifyWebhook').mockReturnValue(false);

            const res = await request(app)
                .post('/api/v1/webhooks/getstream')
                .set(mockHeaders)
                .send(mockPayload);

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Invalid webhook signature');
        });

        it('should handle ping requests', async () => {
            const res = await request(app)
                .post('/api/v1/webhooks/getstream')
                .set(mockHeaders)
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.ping).toBe(true);
        });

        it('should be idempotent (skip if already processed)', async () => {
            // Setup: Pre-create processed event
            await GetstreamWebhookEvent.create({
                eventId: 'evt-123',
                eventType: 'message.new',
                payload: mockPayload,
                headers: mockHeaders,
                status: 'processed',
                receivedAt: new Date(),
                attemptCount: 1
            });

            const res = await request(app)
                .post('/api/v1/webhooks/getstream')
                .set(mockHeaders)
                .send(mockPayload);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Already processed');
        });

        it('should handle retries for existings but not processed events', async () => {
             // Setup: Pre-create pending event
             await GetstreamWebhookEvent.create({
                eventId: 'evt-123',
                eventType: 'message.new',
                payload: mockPayload,
                headers: mockHeaders,
                status: 'pending',
                receivedAt: new Date(),
                attemptCount: 0
            });

            const res = await request(app)
                .post('/api/v1/webhooks/getstream')
                .set(mockHeaders)
                .send(mockPayload);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
