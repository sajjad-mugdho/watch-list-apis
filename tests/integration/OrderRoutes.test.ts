import request from 'supertest';
import { app } from '../../src/app';
import { TestFactory } from '../helpers/TestFactory';
import { MarketplaceListing } from '../../src/models/Listings';
import { Order } from '../../src/models/Order';
import { MerchantOnboarding } from '../../src/models/MerchantOnboarding';
import * as finixUtils from '../../src/utils/finix';

// Mock Finix utility functions
jest.mock('../../src/utils/finix', () => ({
  ...jest.requireActual('../../src/utils/finix'),
  createBuyerIdentity: jest.fn(),
  createPaymentInstrument: jest.fn(),
  getPaymentInstrument: jest.fn(),
  authorizePayment: jest.fn(),
  capturePayment: jest.fn(),
}));

describe('Order Routes', () => {
  let buyer: any;
  let seller: any;
  let listing: any;

  beforeEach(async () => {
    buyer = await TestFactory.createMockUser({ email: 'buyer@example.com', external_id: 'buyer_123' });
    seller = await TestFactory.createMockUser({ email: 'seller@example.com', external_id: 'seller_123' });
    
    // Create merchant record for seller so they can receive payments
    await MerchantOnboarding.create({
      dialist_user_id: seller._id,
      merchant_id: 'merchant_123',
      form_id: 'form_123',
      onboarding_state: 'APPROVED'
    });

    const watch = await TestFactory.createWatch();
    listing = await TestFactory.createMarketplaceListing(seller._id, {
      clerk_id: seller.external_id,
      watch_id: (watch as any)._id,
      price: 100000,
      status: 'active'
    });
  });

  describe('POST /api/v1/marketplace/orders/reserve', () => {
    it('should successfully reserve a listing', async () => {
      const res = await request(app)
        .post('/api/v1/marketplace/orders/reserve')
        .set('x-test-user', buyer.external_id)
        .send({ listing_id: (listing as any)._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('reserved');
      expect(res.body.data.order_id).toBeDefined();

      const updatedListing = await MarketplaceListing.findById((listing as any)._id);
      expect(updatedListing!.reserved_by_user_id!.toString()).toBe(buyer._id.toString());
    });

    it('should not allow buyer to reserve their own listing', async () => {
      const res = await request(app)
        .post('/api/v1/marketplace/orders/reserve')
        .set('x-test-user', seller.external_id)
        .send({ listing_id: (listing as any)._id.toString() });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('cannot purchase your own listing');
    });
  });

  describe('POST /api/v1/marketplace/orders/:id/tokenize', () => {
    let order: any;

    beforeEach(async () => {
      order = await TestFactory.createOrder(buyer._id, seller._id, { listing_id: (listing as any)._id });
    });

    it('should return tokenization config', async () => {
      (finixUtils.createBuyerIdentity as jest.Mock).mockResolvedValue({
        identity_id: 'buyer_identity_123'
      });

      const res = await request(app)
        .post(`/api/v1/marketplace/orders/${(order as any)._id}/tokenize`)
        .set('x-test-user', buyer.external_id)
        .send({ idempotency_id: 'idem_123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.buyer_identity_id).toBe('buyer_identity_123');
    });
  });

  describe('POST /api/v1/marketplace/orders/:id/payment', () => {
    let order: any;

    beforeEach(async () => {
      order = await TestFactory.createOrder(buyer._id, seller._id, { 
        listing_id: (listing as any)._id,
        finix_buyer_identity_id: 'buyer_identity_123',
        reservation_expires_at: new Date(Date.now() + 3600000)
      });
    });

    it('should successfully process payment', async () => {
      (finixUtils.createPaymentInstrument as jest.Mock).mockResolvedValue({
        payment_instrument_id: 'pi_123'
      });
      (finixUtils.getPaymentInstrument as jest.Mock).mockResolvedValue({
        id: 'pi_123',
        payment_instrument_id: 'pi_123',
        address_verification: 'MATCH',
        security_code_verification: 'MATCH'
      });
      (finixUtils.authorizePayment as jest.Mock).mockResolvedValue({
        authorization_id: 'auth_123',
        state: 'SUCCEEDED'
      });
      (finixUtils.capturePayment as jest.Mock).mockResolvedValue({
        transfer_id: 'trans_123',
        state: 'SUCCEEDED'
      });

      const res = await request(app)
        .post(`/api/v1/marketplace/orders/${(order as any)._id}/payment`)
        .set('x-test-user', buyer.external_id)
        .send({
          payment_token: 'token_123',
          idempotency_id: 'idem_456',
          fraud_session_id: 'fraud_123',
          postal_code: '12345',
          address_line1: '123 Main St',
          city: 'New York',
          region: 'NY'
        });

      if (res.status !== 200) {
        console.log('Payment Failure Response:', JSON.stringify(res.body, null, 2));
      }
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Status is "processing" immediately after capture, waiting for webhook for "paid"
      expect(res.body.data.status).toBe('processing');

      const updatedOrder = await Order.findById((order as any)._id);
      expect(updatedOrder!.status).toBe('processing');
    });
  });
});
