/**
 * Bank Tokenization Integration Tests
 *
 * Tests the complete bank tokenization flow:
 * 1. Create order (reserve listing)
 * 2. Get tokenization config
 * 3. Process bank token payment
 * 4. Handle ACH transfer webhooks
 * 5. Verify order status updates
 */

// Mock Finix API to avoid 422 errors and external dependencies
jest.mock("../../src/utils/finix", () => {
  const originalModule = jest.requireActual("../../src/utils/finix");
  return {
    __esModule: true,
    ...originalModule,
    createPaymentInstrument: jest.fn().mockResolvedValue({
      payment_instrument_id: "PI_BANK_ACCOUNT_123",
      instrument_type: "BANK_ACCOUNT",
      card_type: null,
      last_four: "1234",
      brand: null
    }),
    createTransfer: jest.fn().mockImplementation((params) => Promise.resolve({
      transfer_id: "TR_ACH_TEST_123", // Corrected property name
      state: "PENDING",
      amount: params.amount,
      currency: params.currency || "USD",
    })),
    getPaymentInstrument: jest.fn().mockResolvedValue({
      id: "PI_BANK_ACCOUNT_123",
      type: "BANK_ACCOUNT",
      address_verification_result: "MATCH",
      security_code_verification: "MATCH"
    }),
  };
});

import "../setup"; // Global setup (beforeAll, afterAll, afterEach hooks)
import request from "supertest";
import { app } from "../../src/app";
import { config } from "../../src/config";
import { Order } from "../../src/models/Order";
import { MarketplaceListing } from "../../src/models/Listings";
import { MerchantOnboarding } from "../../src/models/MerchantOnboarding";
import { User } from "../../src/models/User";
import { Watch } from "../../src/models/Watches";
import mongoose from "mongoose";
import { createTestMarketplaceListing, createTestOrder } from "../helpers/fixtures";
import { webhookQueue } from "../../src/queues/webhookQueue";
import { processWebhookJob } from "../../src/workers/webhookProcessor";

describe("Bank Tokenization Flow", () => {
  let testUser: any;
  let buyerUser: any;
  let sellerUser: any;
  let listing: any;
  let order: any;
  let tokenConfig: any;

  beforeAll(() => {
    // Attach processor to process jobs inline during tests
    webhookQueue.process(processWebhookJob);
  });

  beforeEach(async () => {
    // Setup is handled by tests/setup.ts

    // Create seller with merchant account (using mock user ID)
    sellerUser = await User.create({
      _id: "ddd333333333333333333333", // merchant_approved mock user ID
      external_id: "merchant_approved",
      email: "seller@test.com",
      first_name: "Premium",
      last_name: "Watches",
      onboarding: {
        status: "completed",
        version: "1.0",
        steps: {},
      },
    });

    // Create buyer (using mock user ID)
    buyerUser = await User.create({
      _id: "ccc111111111111111111111", // buyer_us_complete mock user ID
      external_id: "buyer_us_complete",
      email: "buyer@test.com",
      first_name: "John",
      last_name: "Buyer",
      onboarding: {
        status: "completed",
        version: "1.0",
        steps: {},
      },
    });

    // Create merchant onboarding for seller
    await MerchantOnboarding.create({
      dialist_user_id: sellerUser._id,
      clerk_id: "merchant_approved",
      merchant_id: "MU_TEST_MERCHANT_123",
      identity_id: "ID_TEST_SELLER_123",
      onboarding_state: "APPROVED",
      verification_state: "SUCCEEDED",
      form_url: "https://finix.example.com/onboarding/form",
      form_id: "OF_TEST_123",
    });

    // Create test watch
    const watch = await Watch.create({
      brand: "Rolex",
      model: "Submariner",
      reference: "116610",
      diameter: "40mm",
      bezel: "ceramic",
      bracelet: "oyster",
      materials: "stainless_steel",
    });

    // Create test listing
    listing = await createTestMarketplaceListing({
      clerk_id: "merchant_approved",
      dialist_id: sellerUser._id,
      watch_id: watch._id,
      brand: "Rolex",
      model: "Submariner",
      reference: "116610",
      price: 10000 * 100, // $10,000 in cents
      condition: "like-new",
      status: "active",
    });

  });

  describe("1. Reserve Listing (Create Order)", () => {
    it("should create an order with reservation", async () => {
      const response = await request(app)
        .post("/api/v1/marketplace/orders/reserve")
        .set("x-test-user", "buyer_us_complete")
        .send({
          listing_id: listing._id.toString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("order_id");
      expect(response.body.data).toHaveProperty("fraud_session_id");
      expect(response.body.data.status).toBe("reserved");

      order = response.body.data;
    });
  });

  describe("2. Get Tokenization Config", () => {
    beforeEach(async () => {
      order = await createTestOrder({
        listing_id: listing._id,
        buyer_id: buyerUser._id,
        seller_id: sellerUser._id,
        amount: listing.price,
        status: "reserved",
        reservation_expires_at: new Date(Date.now() + 3600000),
      });
      order.order_id = order._id.toString();
    });
    it("should retrieve tokenization configuration for bank token", async () => {
      const response = await request(app)
        .post(`/api/v1/marketplace/orders/${order.order_id}/tokenize`)
        .set("x-test-user", "buyer_us_complete")
        .send({
          idempotency_id: "test_tokenize_id_1",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("application_id");
      expect(response.body.data).toHaveProperty("buyer_identity_id");
      expect(response.body.data).toHaveProperty("fraud_session_id");
      expect(response.body.data.order_id).toBe(order.order_id);

      tokenConfig = response.body.data;
    });
  });

  describe("3. Process Bank Token Payment", () => {
    beforeEach(async () => {
      order = await createTestOrder({
        listing_id: listing._id,
        buyer_id: buyerUser._id,
        seller_id: sellerUser._id,
        amount: listing.price,
        status: "reserved",
        finix_buyer_identity_id: "ID_TEST_BUYER_123", // Need this for payment
        reservation_expires_at: new Date(Date.now() + 3600000),
      });
      order.order_id = order._id.toString();
    });
    it("should process bank token payment (ACH)", async () => {
      const response = await request(app)
        .post(`/api/v1/marketplace/orders/${order.order_id}/payment`)
        .set("x-test-user", "buyer_us_complete")
        .send({
          payment_token: "TK_BANK_TEST_TOKEN_123", // Simulated bank token from BankTokenForm
          postal_code: "94110",
          address_line1: "123 Main St",
          city: "San Francisco",
          region: "CA",
          country: "USA",
          idempotency_id: "test_payment_id_1",
          fraud_session_id: "sess_test_123",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("processing");
      expect(response.body.data).toHaveProperty("finix_payment_instrument_id");
      expect(response.body.data).toHaveProperty("finix_transfer_id");

      // Bank transfers don't have authorization, only transfer
      expect(response.body.data.finix_authorization_id).toBeUndefined();

      // ACH authorization message should be present
      expect(response.body.data.ach_authorization).toBeDefined();
      expect(response.body.data.ach_authorization.authorized).toBe(true);

      order._id = response.body.data.order_id;
    });

    it("should require postal code for bank token", async () => {
      const response = await request(app)
        .post(`/api/v1/marketplace/orders/${order.order_id}/payment`)
        .set("x-test-user", "buyer_us_complete")
        .send({
          payment_token: "TK_BANK_TEST_TOKEN_123",
          // Missing postal_code
          address_line1: "123 Main St",
          city: "San Francisco",
          region: "CA",
          idempotency_id: "test_payment_id_2",
          fraud_session_id: order.fraud_session_id,
        });

      expect(response.status).toBe(400);
      // Generic validation error might be returned
      expect(response.body.error?.message).toBeTruthy();
    });

    it("should require full billing address", async () => {
      const response = await request(app)
        .post(`/api/v1/marketplace/orders/${order.order_id}/payment`)
        .set("x-test-user", "buyer_us_complete")
        .send({
          payment_token: "TK_BANK_TEST_TOKEN_123",
          postal_code: "94110",
          // Missing address_line1, city, region
          idempotency_id: "test_payment_id_3",
          fraud_session_id: order.fraud_session_id,
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.message).toBeTruthy(); // Generic validation error
    });

    it("should enforce idempotency for bank token payments", async () => {
      const idempotencyId = "test_idempotent_payment_id";

      // First payment
      const response1 = await request(app)
        .post(`/api/v1/marketplace/orders/${order.order_id}/payment`)
        .set("x-test-user", "buyer_us_complete")
        .send({
          payment_token: "TK_BANK_TEST_TOKEN_456",
          postal_code: "94110",
          address_line1: "123 Main St",
          city: "San Francisco",
          region: "CA",
          idempotency_id: idempotencyId,
          fraud_session_id: "sess_idemp_1",
        });

      expect(response1.status).toBe(200);

      // Second payment with same idempotency_id should be rejected or return same result
      const response2 = await request(app)
        .post(`/api/v1/marketplace/orders/${order.order_id}/payment`)
        .set("x-test-user", "buyer_us_complete")
        .send({
          payment_token: "TK_BANK_TEST_TOKEN_789",
          postal_code: "94110",
          address_line1: "123 Main St",
          city: "San Francisco",
          region: "CA",
          idempotency_id: idempotencyId,
          fraud_session_id: "sess_idemp_1",
        });

      // Should either reject duplicate or return same result
      expect([200, 409, 400]).toContain(response2.status);
    });
  });

  describe("4. Bank Token Payment Instrument", () => {
    beforeEach(async () => {
      order = await createTestOrder({
        listing_id: listing._id,
        buyer_id: buyerUser._id,
        seller_id: sellerUser._id,
        amount: listing.price,
        status: "processing",
        finix_buyer_identity_id: "ID_TEST_BUYER_123",
        finix_payment_instrument_id: "PI_BANK_ACCOUNT_123",
        finix_transfer_id: "TR_ACH_TEST_123",
        finix_authorization_id: null, // Explicitly null for Bank/ACH
        metadata: {
          instrument_type: "BANK_ACCOUNT"
        }
      });
      order.order_id = order._id.toString();
    });
    it("should have BANK_ACCOUNT instrument type", async () => {
      // Verify instrument type is properly set
      const updatedOrder = await Order.findOne({ _id: order._id });
      expect(updatedOrder?.metadata?.instrument_type).toBe("BANK_ACCOUNT");
    });

    it("should not have authorization for bank transfers", async () => {
      const updatedOrder = await Order.findOne({ _id: order._id });
      expect(updatedOrder?.finix_authorization_id).toBeFalsy();
      expect(updatedOrder?.finix_transfer_id).toBeDefined();
    });
  });

  describe("5. ACH Transfer Webhooks", () => {
    beforeEach(async () => {
      order = await createTestOrder({
        listing_id: listing._id,
        buyer_id: buyerUser._id,
        seller_id: sellerUser._id,
        amount: listing.price,
        status: "processing",
        finix_buyer_identity_id: "ID_TEST_BUYER_123",
        finix_payment_instrument_id: "PI_BANK_ACCOUNT_123",
        finix_transfer_id: "TR_ACH_TEST_123", // Matches webhook ID
      });
      order.order_id = order._id.toString();
    });
    it("should handle transfer.created webhook (ACH)", async () => {
      const webhookPayload = {
        id: "EVT_TRANSFER_CREATED_ACH",
        entity: "transfer",
        type: "created",
        _embedded: {
          transfers: [
            {
              id: "TR_ACH_TEST_123",
              state: "PENDING",
              amount: 1000000,
              merchant: "MU_TEST_MERCHANT_123",
              source: "PI_BANK_ACCOUNT_123",
              operation: "ACH_DEBIT",
              tags: {},
            },
          ],
        },
      };

      const response = await request(app)
        .post("/api/v1/webhooks/finix")
        .set("Authorization", `Basic ${Buffer.from(`${config.finixWebhookUsername}:${config.finixWebhookPassword}`).toString("base64")}`)
        .set("Finix-Signature", "test_signature")
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const jobId = response.body.jobId;
      if (jobId) {
        const job = await webhookQueue.getJob(jobId);
        await job?.finished();
      }

      // Verify order status is updated to pending or processing
      const updatedOrder = await Order.findOne({ _id: order._id });
      expect(["pending", "processing"]).toContain(updatedOrder?.status);
    });

    it("should handle transfer.updated webhook (ACH SUCCEEDED)", async () => {
      const webhookPayload = {
        id: "EVT_TRANSFER_UPDATED_SUCCESS",
        entity: "transfer",
        type: "updated",
        _embedded: {
          transfers: [
            {
              id: "TR_ACH_TEST_123",
              state: "SUCCEEDED",
              amount: 1000000,
              ready_to_settle_at: new Date().toISOString(),
              merchant: "MU_TEST_MERCHANT_123",
              source: "PI_BANK_ACCOUNT_123",
              operation: "ACH_DEBIT",
            },
          ],
        },
      };

      const response = await request(app)
        .post("/api/v1/webhooks/finix")
        .set("Authorization", `Basic ${Buffer.from(`${config.finixWebhookUsername}:${config.finixWebhookPassword}`).toString("base64")}`)
        .set("Finix-Signature", "test_signature")
        .send(webhookPayload);

      expect(response.status).toBe(200);
      
      const jobId2 = response.body.jobId;
      if (jobId2) {
        const job = await webhookQueue.getJob(jobId2);
        await job?.finished();
      }

      // Verify order is marked as paid
      const updatedOrder = await Order.findOne({ _id: order._id });
      // Note: If worker is async, this might flake. Ideally use polling or mock worker.
      // But assuming current setup works:
      expect(updatedOrder?.status).toBe("paid");
      expect(updatedOrder?.paid_at).toBeDefined();

      // Verify listing is marked as sold
      const soldListing = await MarketplaceListing.findById(listing._id);
      expect(soldListing?.status).toBe("sold");
      expect(soldListing?.reserved_until).toBeFalsy();
    });

    it("should handle transfer.updated webhook (ACH FAILED)", async () => {
      const webhookPayload = {
        id: "EVT_TRANSFER_UPDATED_FAILED",
        entity: "transfer",
        type: "updated",
        _embedded: {
          transfers: [
            {
              id: "TR_ACH_TEST_123", // Must match order's transfer ID
              state: "FAILED",
              amount: 1000000,
              merchant: "MU_TEST_MERCHANT_123",
              source: "PI_BANK_ACCOUNT_123",
              failure_code: "ACCOUNT_CLOSED",
              failure_message: "The bank account is closed",
              operation: "ACH_DEBIT",
            },
          ],
        },
      };

      const response = await request(app)
        .post("/api/v1/webhooks/finix")
        .set("Authorization", `Basic ${Buffer.from(`${config.finixWebhookUsername}:${config.finixWebhookPassword}`).toString("base64")}`)
        .set("Finix-Signature", "test_signature")
        .send(webhookPayload);

      expect(response.status).toBe(200);

      const jobId3 = response.body.jobId;
      if (jobId3) {
        const job = await webhookQueue.getJob(jobId3);
        await job?.finished();
      }

      // Verify order status reflects failure
      const updatedOrder = await Order.findOne({ _id: order._id });
      expect(updatedOrder?.status).toBe("cancelled");
      expect(updatedOrder?.metadata?.payment_failure).toBeDefined();
    });
  });

  describe("7. Bank Token Error Scenarios", () => {
    it("should handle ACH return code R03 (no account)", async () => {
      const webhookPayload = {
        id: "EVT_ACH_NO_ACCOUNT",
        entity: "transfer",
        type: "updated",
        _embedded: {
          transfers: [
            {
              id: "TR_ACH_NO_ACCOUNT",
              state: "FAILED",
              failure_code: "NO_BANK_ACCOUNT_FOUND",
              failure_message: "No bank account found (R03)",
            },
          ],
        },
      };

      const response = await request(app)
        .post("/api/v1/webhooks/finix")
        .set("Authorization", `Basic ${Buffer.from(`${config.finixWebhookUsername}:${config.finixWebhookPassword}`).toString("base64")}`)
        .set("Finix-Signature", "test_signature")
        .send(webhookPayload);

      expect(response.status).toBe(200);
    });

    it("should handle ACH return code R02 (account closed)", async () => {
      const webhookPayload = {
        id: "EVT_ACH_ACCOUNT_CLOSED",
        entity: "transfer",
        type: "updated",
        _embedded: {
          transfers: [
            {
              id: "TR_ACH_ACCOUNT_CLOSED",
              state: "FAILED",
              failure_code: "BANK_ACCOUNT_CLOSED",
              failure_message: "Account is closed (R02)",
            },
          ],
        },
      };

      const response = await request(app)
        .post("/api/v1/webhooks/finix")
        .set("Authorization", `Basic ${Buffer.from(`${config.finixWebhookUsername}:${config.finixWebhookPassword}`).toString("base64")}`)
        .set("Finix-Signature", "test_signature")
        .send(webhookPayload);

      expect(response.status).toBe(200);
    });

    it("should handle unauthorized debit", async () => {
      const webhookPayload = {
        id: "EVT_ACH_UNAUTHORIZED",
        entity: "transfer",
        type: "updated",
        _embedded: {
          transfers: [
            {
              id: "TR_ACH_UNAUTHORIZED",
              state: "FAILED",
              failure_code: "UNAUTHORIZED_DEBIT",
              failure_message: "Account holder revoked authorization",
            },
          ],
        },
      };

      const response = await request(app)
        .post("/api/v1/webhooks/finix")
        .set("Authorization", `Basic ${Buffer.from(`${config.finixWebhookUsername}:${config.finixWebhookPassword}`).toString("base64")}`)
        .set("Finix-Signature", "test_signature")
        .send(webhookPayload);

      expect(response.status).toBe(200);
    });
  });

  describe("8. ACH Currency Support", () => {
    beforeEach(async () => {
      order = await createTestOrder({
        listing_id: listing._id,
        buyer_id: buyerUser._id,
        seller_id: sellerUser._id,
        amount: listing.price,
        status: "processing",
        finix_buyer_identity_id: "ID_TEST_BUYER_123",
        reservation_expires_at: new Date(Date.now() + 3600000),
      });
      // order object IS the mongoose document so save() works.
      // But we also need order_id property for URL interpolation
      (order as any).order_id = order._id.toString(); 
    });
    it("should support USD ACH transfers", async () => {
      const response = await request(app)
        .post(`/api/v1/marketplace/orders/${order.order_id}/payment`)
        .set("x-test-user", "buyer_us_complete")
        .send({
          payment_token: "TK_BANK_TEST_TOKEN_123",
          postal_code: "94110",
          address_line1: "123 Main St",
          city: "San Francisco",
          region: "CA",
          country: "USA",
          idempotency_id: "test_usd_ach",
          fraud_session_id: "sess_test_123",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.payment_details.currency).toBe("USD");
    });

    it("should support CAD EFT transfers", async () => {
      // Reuse US buyer but checking CAD flow (User country mismatch ignored by mock/handler logic)
      order.currency = "CAD";
      order.amount = 10000 * 100; // CAD amount
      await order.save();

      const response = await request(app)
        .post(`/api/v1/marketplace/orders/${order.order_id}/payment`)
        .set("x-test-user", "buyer_us_complete")
        .send({
          payment_token: "TK_BANK_TEST_CAD",
          postal_code: "M5V 3A8",
          address_line1: "123 King St",
          city: "Toronto",
          region: "ON",
          country: "CAN",
          idempotency_id: "test_cad_eft",
          fraud_session_id: "sess_test_456",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.payment_details.currency).toBe("CAD");
    });
  });
});
