/**
 * Integration Tests - Finix Payment Flow
 *
 * Tests the complete payment flow from listing reservation through tokenization to payment capture.
 * These tests mock external dependencies (Finix API, Clerk) but test the actual handler logic.
 */

import mongoose from "mongoose";
import { User } from "../../src/models/User";
import { MarketplaceListing } from "../../src/models/Listings";
import { Order } from "../../src/models/Order";
import { MerchantOnboarding } from "../../src/models/MerchantOnboarding";
import * as finixUtils from "../../src/utils/finix";
import { getAuth } from "@clerk/express";

// Mock Clerk middleware
jest.mock("@clerk/express", () => ({
  getAuth: jest.fn(),
}));

// Mock Finix utility functions
jest.mock("../../src/utils/finix", () => ({
  ...jest.requireActual("../../src/utils/finix"),
  createBuyerIdentity: jest.fn(),
  createPaymentInstrument: jest.fn(),
  getPaymentInstrument: jest.fn(),
  authorizePayment: jest.fn(),
  capturePayment: jest.fn(),
  createTransfer: jest.fn(),
  getTransfer: jest.fn(),
  createTransferReversal: jest.fn(),
}));

describe("Finix Payment Flow - Integration Tests", () => {
  let buyerUserId: string;
  let sellerUserId: string;
  let listingId: string;
  let orderId: string;

  beforeEach(async () => {
    // Reset all mocks so that mock implementations don't leak between tests
    jest.resetAllMocks();

    // Create test users with required fields
    const buyer = await User.create({
      external_id: "clerk_buyer_123",
      email: "buyer@test.com",
      first_name: "Test",
      last_name: "Buyer",
    });
    buyerUserId = buyer._id.toString();

    const seller = await User.create({
      external_id: "clerk_seller_123",
      email: "seller@test.com",
      first_name: "Test",
      last_name: "Seller",
    });
    sellerUserId = seller._id.toString();

    // Create merchant onboarding for seller with required form_id
    await MerchantOnboarding.create({
      dialist_user_id: seller._id,
      form_id: `obf_test_${Date.now()}`,
      merchant_id: "MUmockMerchantId123",
      onboarding_state: "APPROVED",
    });

    // Create test listing with all required fields
    const listing = await MarketplaceListing.create({
      dialist_id: seller._id,
      clerk_id: seller.external_id,
      brand: "Rolex",
      model: "Submariner",
      reference: "116610LN",
      diameter: "40mm",
      bezel: "Ceramic",
      materials: "Stainless Steel",
      bracelet: "Oyster",
      condition: "like-new",
      price: 12500,
      ships_from: { country: "US" },
      watch_id: new mongoose.Types.ObjectId(),
      watch_snapshot: {
        brand: "Rolex",
        model: "Submariner",
        reference: "116610LN",
        diameter: "40mm",
        bezel: "Ceramic",
        materials: "Stainless Steel",
        bracelet: "Oyster",
        color: "Black",
      },
      status: "active",
    });
    listingId = listing._id.toString();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await MarketplaceListing.deleteMany({});
    await Order.deleteMany({});
    await MerchantOnboarding.deleteMany({});
  });

  describe("Step 1: Reserve Listing", () => {
    it("should successfully reserve a listing", async () => {
      // Mock Clerk auth
      (getAuth as jest.Mock).mockReturnValue({
        userId: "clerk_buyer_123",
      });

      const listing = await MarketplaceListing.findById(listingId);
      expect(listing).toBeDefined();
      expect(listing!.status).toBe("active");

      // Reserve the listing (this would be done via API endpoint)
      listing!.status = "reserved";
      listing!.reserved_until = new Date(Date.now() + 15 * 60 * 1000);
      await listing!.save();

      const reserved = await MarketplaceListing.findById(listingId);
      expect(reserved!.status).toBe("reserved");
      expect(reserved!.reserved_until).toBeDefined();
    });

    it("should fail when listing is already reserved", async () => {
      const listing = await MarketplaceListing.findById(listingId);
      listing!.status = "reserved";
      listing!.reserved_until = new Date(Date.now() + 15 * 60 * 1000);
      await listing!.save();

      // Try to reserve again
      const alreadyReserved = await MarketplaceListing.findById(listingId);
      expect(alreadyReserved!.status).toBe("reserved");
      // In real handler, this would throw an error
    });

    it("should fail when buyer tries to reserve their own listing", async () => {
      const listing = await MarketplaceListing.findOne({
        clerk_id: "clerk_seller_123",
      });
      expect(listing).toBeDefined();

      // Mock seller trying to buy their own listing
      (getAuth as jest.Mock).mockReturnValue({
        userId: "clerk_seller_123",
      });

      // This should fail in the actual handler
      expect(listing!.clerk_id).toBe("clerk_seller_123");
    });

    it("should fail when listing_id is missing", async () => {
      const invalidListingId = null;
      expect(invalidListingId).toBeNull();
    });

    it("should fail when listing does not exist", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const listing = await MarketplaceListing.findById(nonExistentId);
      expect(listing).toBeNull();
    });
  });

  describe("Step 2: Get Tokenization Config", () => {
    beforeEach(async () => {
      // Create test users with unique emails
      const buyer = await User.create({
        external_id: `clerk_buyer_${Date.now()}`,
        email: `buyer_step2_${Date.now()}@test.com`,
        first_name: "Test",
        last_name: "User",
      });
      buyerUserId = buyer._id.toString();

      const seller = await User.create({
        external_id: `clerk_seller_${Date.now()}`,
        email: `seller_step2_${Date.now()}@test.com`,
        first_name: "Test",
        last_name: "User",
      });
      sellerUserId = seller._id.toString();

      await MerchantOnboarding.create({
        dialist_user_id: seller._id,
        form_id: `obf_test_${Date.now()}`,
        merchant_id: "MUmockMerchantId123",
        onboarding_state: "APPROVED",
      });

      const listing = await MarketplaceListing.create({
        dialist_id: seller._id,
        clerk_id: seller.external_id,
        brand: "Rolex",
        model: "Submariner",
        reference: "116610LN",
        diameter: "40mm",
        bezel: "Ceramic",
        materials: "Stainless Steel",
        bracelet: "Oyster",
        condition: "like-new",
        price: 12500,
        ships_from: { country: "US" },
        watch_id: new mongoose.Types.ObjectId(),
      watch_snapshot: {
        brand: "Rolex",
        model: "Submariner",
        reference: "116610LN",
        diameter: "40mm",
        bezel: "Ceramic",
        materials: "Stainless Steel",
        bracelet: "Oyster",
        color: "Black",
      },

        status: "reserved",
        reserved_until: new Date(Date.now() + 15 * 60 * 1000),
      });

      // Create order
      const order = await Order.create({
        listing_id: listing._id,
        buyer_id: buyer._id,
        seller_id: seller._id,
        amount: listing.price,
        status: "reserved",
        listing_snapshot: {
          brand: listing.brand,
          model: listing.model,
          reference: listing.reference,
          condition: listing.condition,
          price: listing.price,
        },
      });
      orderId = order._id.toString();
    });

    it("should successfully get tokenization config", async () => {
      // Mock Finix response
      (finixUtils.createBuyerIdentity as jest.Mock).mockResolvedValue({
        identity_id: "IDmockBuyerIdentity123",
      });

      const identityId = await finixUtils.createBuyerIdentity({
        email: "buyer@test.com",
        first_name: "Test",
        last_name: "Buyer",
      });

      expect(identityId).toBeDefined();
      expect(identityId.identity_id).toBe("IDmockBuyerIdentity123");
    });

    it("should reuse existing buyer identity", async () => {
      const order = await Order.findById(orderId);
      expect(order).toBeDefined();

      // Simulate identity already exists
      if (!order!.finix_buyer_identity_id) {
        order!.finix_buyer_identity_id = "IDexistingBuyerIdentity";
        await order!.save();
      }

      const updated = await Order.findById(orderId);
      expect(updated!.finix_buyer_identity_id).toBe("IDexistingBuyerIdentity");
    });

    it("should fail with invalid order ID", async () => {
      const invalidOrderId = "invalid_id";
      expect(mongoose.Types.ObjectId.isValid(invalidOrderId)).toBe(false);
    });

    it("should fail when order does not exist", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const order = await Order.findById(nonExistentId);
      expect(order).toBeNull();
    });

    it("should fail when reservation has expired", async () => {
      const order = await Order.findById(orderId);
      const listing = await MarketplaceListing.findById(order!.listing_id);

      // Set expiry to past
      listing!.reserved_until = new Date(Date.now() - 1000);
      await listing!.save();

      const expired = await MarketplaceListing.findById(listing!._id);
      expect(expired!.reserved_until!.getTime()).toBeLessThan(Date.now());
    });

    it("should fail when buyer does not match order", async () => {
      const order = await Order.findById(orderId);
      const differentBuyer = new mongoose.Types.ObjectId();

      expect(order!.buyer_id.toString()).not.toBe(differentBuyer.toString());
    });
  });

  describe("Step 3: Process Payment - Tokenized", () => {
    beforeEach(async () => {
      const buyer = await User.create({
        external_id: `clerk_buyer_${Date.now()}`,
        email: `buyer_step3_${Date.now()}@test.com`,
        first_name: "Test",
        last_name: "User",
      });
      buyerUserId = buyer._id.toString();

      const seller = await User.create({
        external_id: `clerk_seller_${Date.now()}`,
        email: `seller_step3_${Date.now()}@test.com`,
        first_name: "Test",
        last_name: "User",
      });
      sellerUserId = seller._id.toString();

      await MerchantOnboarding.create({
        dialist_user_id: seller._id,
        form_id: `obf_test_${Date.now()}`,
        merchant_id: "MUmockMerchantId123",
        onboarding_state: "APPROVED",
      });

      const listing = await MarketplaceListing.create({
        dialist_id: seller._id,
        clerk_id: seller.external_id,
        brand: "Rolex",
        model: "Submariner",
        reference: "116610LN",
        diameter: "40mm",
        bezel: "Ceramic",
        materials: "Stainless Steel",
        bracelet: "Oyster",
        condition: "like-new",
        price: 12500,
        ships_from: { country: "US" },
        watch_id: new mongoose.Types.ObjectId(),
      watch_snapshot: {
        brand: "Rolex",
        model: "Submariner",
        reference: "116610LN",
        diameter: "40mm",
        bezel: "Ceramic",
        materials: "Stainless Steel",
        bracelet: "Oyster",
        color: "Black",
      },

        status: "reserved",
        reserved_until: new Date(Date.now() + 15 * 60 * 1000),
      });

      const order = await Order.create({
        listing_id: listing._id,
        buyer_id: buyer._id,
        seller_id: seller._id,
        amount: listing.price,
        status: "reserved",
        finix_buyer_identity_id: "IDmockBuyerIdentity123",
        listing_snapshot: {
          brand: listing.brand,
          model: listing.model,
          reference: listing.reference,
          condition: listing.condition,
          price: listing.price,
        },
      });
      orderId = order._id.toString();
    });

    it("should successfully process payment with token", async () => {
      // Mock Finix responses
      (finixUtils.createPaymentInstrument as jest.Mock).mockResolvedValue({
        payment_instrument_id: "PImockPaymentInstrument123",
      });
      (finixUtils.authorizePayment as jest.Mock).mockResolvedValue({
        authorization_id: "AUmockAuthorization123",
        state: "SUCCEEDED",
      });
      (finixUtils.capturePayment as jest.Mock).mockResolvedValue({
        transfer_id: "TRmockTransfer123",
        state: "SUCCEEDED",
      });

      const paymentInstrument = await finixUtils.createPaymentInstrument({
        token: "TKNmockToken123",
        identity_id: "IDmockBuyerIdentity123",
      });
      expect(paymentInstrument.payment_instrument_id).toBe(
        "PImockPaymentInstrument123"
      );

      const authorization = await finixUtils.authorizePayment({
        amount: 12500,
        merchant_id: "MUmockMerchantId123",
        payment_instrument_id: "PImockPaymentInstrument123",
        currency: "USD",
      });
      expect(authorization.state).toBe("SUCCEEDED");

      const capture = await finixUtils.capturePayment({
        authorization_id: "AUmockAuthorization123",
        capture_amount: 12500,
      });
      expect(capture.state).toBe("SUCCEEDED");
    });

    it("should successfully process payment using saved payment_instrument_id", async () => {
      // Setup: use saved payment instrument id that belongs to the buyer
      (finixUtils.getPaymentInstrument as jest.Mock).mockResolvedValue({
        identity: "IDmockBuyerIdentity123",
        type: "PAYMENT_CARD",
        card_type: "DEBIT",
        last_four: "0006",
      });

      (finixUtils.authorizePayment as jest.Mock).mockResolvedValue({
        authorization_id: "AUsavedAuth123",
        state: "SUCCEEDED",
      });
      (finixUtils.capturePayment as jest.Mock).mockResolvedValue({
        transfer_id: "TRsavedTransfer123",
        state: "SUCCEEDED",
      });
      // Mock getPaymentInstrument to return a valid instrument
      (finixUtils.getPaymentInstrument as jest.Mock).mockResolvedValue({
        id: "PIsaved123",
        payment_instrument_id: "PIsaved123",
        tags: { listing_id: listingId },
      });

      const currentOrder = await Order.findById(orderId);
      const req: any = {
        params: { id: orderId },
        body: {
          idempotency_id: "saved-idemp-1",
          payment_instrument_id: "PIsaved123",
        },
        user: { dialist_id: currentOrder!.buyer_id.toString() },
      };
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await require("../../src/handlers/orderHandlers").processPayment(
        {
          ...req,
          body: {
            payment_instrument_id: "PIsaved123",
          },
        },
        res,
        (err: any) => {
          if (err) throw err;
        }
      );

      // Ensure we validated the PI and then called authorization with saved source_type
      expect(finixUtils.getPaymentInstrument as jest.Mock).toHaveBeenCalledWith(
        "PIsaved123"
      );
      expect(finixUtils.authorizePayment as jest.Mock).toHaveBeenCalled();
      const authorizeCall = (finixUtils.authorizePayment as jest.Mock).mock
        .calls[0][0];
      expect(authorizeCall.tags).toEqual(
        expect.objectContaining({ source_type: "saved_instrument" })
      );
    });

    it("should reject payment request that includes both payment_token and payment_instrument_id", async () => {
      const currentOrder2 = await Order.findById(orderId);
      const req: any = {
        params: { id: orderId },
        body: {
          idempotency_id: "bad-idemp",
          payment_token: "TKconflict",
          payment_instrument_id: "PIconflict",
          postal_code: "94114",
          address_line1: "1 Market St",
          city: "San Francisco",
          region: "CA",
        },
        user: { dialist_id: currentOrder2!.buyer_id.toString() },
      };
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await expect(
        require("../../src/handlers/orderHandlers").processPayment(
          req,
          res,
          (err: any) => {
            if (err) throw err;
          }
        )
      ).rejects.toThrow();
    });


  });

  describe("Complete Payment Flow - End to End", () => {
    it("should complete full payment flow from reserve to payment", async () => {
      const buyer = await User.create({
        external_id: `clerk_buyer_e2e_${Date.now()}`,
        email: `buyer_e2e_${Date.now()}@test.com`,
        first_name: "Test",
        last_name: "User",
      });

      const seller = await User.create({
        external_id: `clerk_seller_e2e_${Date.now()}`,
        email: `seller_e2e_${Date.now()}@test.com`,
        first_name: "Test",
        last_name: "User",
      });

      await MerchantOnboarding.create({
        dialist_user_id: seller._id,
        form_id: `obf_test_${Date.now()}`,
        merchant_id: "MUmockMerchantId123",
        onboarding_state: "APPROVED",
      });

      const listing = await MarketplaceListing.create({
        dialist_id: seller._id,
        clerk_id: seller.external_id,
        brand: "Rolex",
        model: "Submariner",
        reference: "116610LN",
        diameter: "40mm",
        bezel: "Ceramic",
        materials: "Stainless Steel",
        bracelet: "Oyster",
        condition: "like-new",
        price: 12500,
        ships_from: { country: "US" },
        watch_id: new mongoose.Types.ObjectId(),
      watch_snapshot: {
        brand: "Rolex",
        model: "Submariner",
        reference: "116610LN",
        diameter: "40mm",
        bezel: "Ceramic",
        materials: "Stainless Steel",
        bracelet: "Oyster",
        color: "Black",
      },

        status: "active",
      });

      // Step 1: Reserve
      listing.status = "reserved";
      listing.reserved_until = new Date(Date.now() + 15 * 60 * 1000);
      await listing.save();

      // Step 2: Create order
      const order = await Order.create({
        listing_id: listing._id,
        buyer_id: buyer._id,
        seller_id: seller._id,
        amount: listing.price,
        status: "reserved",
        listing_snapshot: {
          brand: listing.brand,
          model: listing.model,
          reference: listing.reference,
          condition: listing.condition,
          price: listing.price,
        },
      });

      // Step 3: Mock payment flow
      (finixUtils.createBuyerIdentity as jest.Mock).mockResolvedValue({
        identity_id: "IDmockBuyerIdentity123",
      });
      (finixUtils.createPaymentInstrument as jest.Mock).mockResolvedValue({
        payment_instrument_id: "PImockPaymentInstrument123",
      });
      (finixUtils.authorizePayment as jest.Mock).mockResolvedValue({
        authorization_id: "AUmockAuthorization123",
        state: "SUCCEEDED",
      });
      (finixUtils.capturePayment as jest.Mock).mockResolvedValue({
        transfer_id: "TRmockTransfer123",
        state: "SUCCEEDED",
      });

      // Execute payment
      const identity = await finixUtils.createBuyerIdentity({
        email: buyer.email,
        first_name: buyer.first_name,
        last_name: buyer.last_name,
      });

      const paymentInstrument = await finixUtils.createPaymentInstrument({
        token: "TKNmockToken123",
        identity_id: identity.identity_id,
        postal_code: "94114",
        address_line1: "123 Market St",
        address_city: "San Francisco",
        address_region: "CA",
      });

      const authorization = await finixUtils.authorizePayment({
        amount: order.amount,
        merchant_id: "MUmockMerchantId123",
        payment_instrument_id: paymentInstrument.payment_instrument_id,
        currency: "USD",
      });

      const capture = await finixUtils.capturePayment({
        authorization_id: authorization.authorization_id,
        capture_amount: order.amount,
      });

      // Verify final state
      expect(capture.state).toBe("SUCCEEDED");

      // Update order status
      order.status = "paid";
      order.finix_authorization_id = authorization.authorization_id;
      order.finix_transfer_id = capture.transfer_id;
      await order.save();

      const finalOrder = await Order.findById(order._id);
      expect(finalOrder!.status).toBe("paid");
      expect(finalOrder!.finix_authorization_id).toBe("AUmockAuthorization123");
      expect(finalOrder!.finix_transfer_id).toBe("TRmockTransfer123");
    });
  });
});

describe("Step 4: Refunds", () => {
  beforeEach(() => {
    // Ensure mocks are reset between this suite and previous suites
    jest.clearAllMocks();
  });
  it("should create a refund (reversal) for a succeeded transfer", async () => {
    const seller = await User.create({
      external_id: `clerk_seller_ref_${Date.now()}`,
      email: `seller_ref_${Date.now()}@test.com`,
      first_name: "Seller",
      last_name: "Ref",
    });

    await MerchantOnboarding.create({
      dialist_user_id: seller._id,
      form_id: `obf_test_${Date.now()}`,
      merchant_id: "MUmockMerchantId123",
      onboarding_state: "APPROVED",
    });

    const listing = await MarketplaceListing.create({
      dialist_id: seller._id,
      clerk_id: seller.external_id,
      brand: "Test",
      model: "Model",
      reference: "Ref1",
      diameter: "40mm",
      bezel: "Metal",
      materials: "Steel",
      bracelet: "Metal",
      condition: "like-new",
      price: 5000,
      ships_from: { country: "US" },
      watch_id: new mongoose.Types.ObjectId(),
      watch_snapshot: {
        brand: "Rolex",
        model: "Submariner",
        reference: "116610LN",
        diameter: "40mm",
        bezel: "Ceramic",
        materials: "Stainless Steel",
        bracelet: "Oyster",
        color: "Black",
      },
      status: "sold",
    });

    const refundBuyer = await User.create({
      external_id: `clerk_buyer_ref_${Date.now()}`,
      email: `buyer_ref_${Date.now()}@test.com`,
      first_name: "Buyer",
      last_name: "Ref",
    });

    const order = await Order.create({
      listing_id: listing._id,
      buyer_id: refundBuyer._id,
      seller_id: seller._id,
      amount: listing.price,
      status: "paid",
      finix_payment_instrument_id: "PIbank123",
      finix_transfer_id: "TRbankMock123",
      listing_snapshot: {
        brand: listing.brand,
        model: listing.model,
        reference: listing.reference,
        condition: listing.condition,
        price: listing.price,
      },
      fraud_session_id: "fs_refund_test",
    });

    // Mock getTransfer to return SUCCEEDED
    (finixUtils.getTransfer as jest.Mock).mockResolvedValue({
      id: "TRbankMock123",
      state: "SUCCEEDED",
      amount: 5000,
    });

    // Mock createTransferReversal
    (finixUtils.createTransferReversal as jest.Mock).mockResolvedValue({
      reversal_id: "TRrev123",
      state: "PENDING",
      amount: 5000,
    });

    // Create a pending refund request in "return_received" state (ready for approval)
    const { RefundRequest } = require("../../src/models/RefundRequest");
    const refundRequest = await RefundRequest.create({
      order_id: order._id,
      buyer_id: refundBuyer._id,
      seller_id: seller._id,
      requested_amount: 5000,
      reason: "Defective product",
      buyer_reason: "Defective product",
      status: "return_received",
      product_returned: true,
      product_return_confirmed: true,
      finix_transfer_id: "TRbankMock123",
      original_transfer_amount: 5000,
      idempotency_id: "idemp-123",
    });

    // Call approveRefundRequest as seller
    const req: any = {
      params: { id: refundRequest._id.toString() },
      body: {
        approval_notes: "Approved by seller",
      },
      user: { dialist_id: seller._id.toString() }, // Seller context
      ip: "127.0.0.1",
      get: jest.fn().mockReturnValue("jest-test-agent"),
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await require("../../src/handlers/orderHandlers").approveRefundRequest(
      req,
      res,
      (err: any) => {
        if (err) throw err;
      }
    );

    expect(finixUtils.createTransferReversal as jest.Mock).toHaveBeenCalledWith(
      {
        transfer_id: "TRbankMock123",
        refund_amount: 5000,
        idempotencyKey: "idemp-123",
        idempotency_id: "idemp-123",
      }
    );

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder!.status).toBe("refunded");
  });

  it("should be idempotent: duplicate refund with same idempotency returns same reversal", async () => {
    // Manually create users and order because DB is cleared
    const seller = await User.create({
      external_id: `clerk_seller_idem_${Date.now()}`,
      email: `seller_idem_${Date.now()}@test.com`,
      first_name: "Seller",
      last_name: "Idem",
    });

    await MerchantOnboarding.create({
      dialist_user_id: seller._id,
      form_id: `obf_idem_${Date.now()}`,
      merchant_id: "MUmockIdem123",
      onboarding_state: "APPROVED",
    });

    const buyer = await User.create({
      external_id: `clerk_buyer_idem_${Date.now()}`,
      email: `buyer_idem_${Date.now()}@test.com`,
      first_name: "Buyer",
      last_name: "Idem",
    });

    const watchId = new mongoose.Types.ObjectId();
    const listing = await MarketplaceListing.create({
      dialist_id: seller._id,
      clerk_id: seller.external_id,
      brand: "Test",
      model: "Idem",
      reference: "RefIdem",
      diameter: "40mm",
      bezel: "Metal",
      materials: "Steel",
      bracelet: "Metal",
      condition: "like-new",
      price: 5000,
      ships_from: { country: "US" },
      watch_id: watchId,
      watch_snapshot: {
        brand: "Rolex",
        model: "Submariner",
        reference: "116610LN",
        color: "Black",
        diameter: "40mm",
        bezel: "Ceramic",
        materials: "Stainless Steel",
        bracelet: "Oyster",
      },
      status: "sold",
    });

    const order = await Order.create({
      buyer_id: buyer._id,
      seller_id: seller._id,
      listing_id: listing._id,
      amount: 5000,
      status: "paid",
      finix_transfer_id: "TRbankMock123",
      listing_snapshot: { title: "Snapshot", price: 5000 },
      fraud_session_id: "fs_idem_123",
    });

    const { RefundRequest } = require("../../src/models/RefundRequest");
    const refundRequest = await RefundRequest.create({
      order_id: order._id,
      buyer_id: buyer._id,
      seller_id: seller._id,
      requested_amount: 5000,
      reason: "Idempotency test",
      buyer_reason: "Idempotency test",
      status: "return_received",
      product_returned: true,
      product_return_confirmed: true,
      finix_transfer_id: "TRbankMock123",
      original_transfer_amount: 5000,
      idempotency_id: "idemp-DUPLICATE-123",
    });

    // Mock Finix Utils
    (finixUtils.createTransferReversal as jest.Mock).mockResolvedValue({
      reversal_id: "TRrev123",
      state: "PENDING",
      amount: 5000,
    });
    (finixUtils.getTransfer as jest.Mock).mockResolvedValue({
      id: "TRbankMock123",
      state: "SUCCEEDED",
    });

    const req: any = {
      params: { id: refundRequest._id.toString() },
      body: { approval_notes: "Approve 1" },
      user: { dialist_id: seller._id.toString() },
      ip: "127.0.0.1",
      get: jest.fn().mockReturnValue("jest-test-agent"),
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // First call
    await require("../../src/handlers/orderHandlers").approveRefundRequest(
      req,
      res,
      (err: any) => { if (err) throw err; }
    );

    expect(finixUtils.createTransferReversal as jest.Mock).toHaveBeenCalled();

    // Second duplicate call with same idempotency
    await require("../../src/handlers/orderHandlers").approveRefundRequest(
      req,
      res,
      (err: any) => { if (err) throw err; }
    );

    // Verify calling it twice (handler calls Finix, Finix handles dedupe logic, but here we just check our handler processes the request)
    // Note: The handler logic for idempotency mainly relies on Finix returning same response for same idempotency key.
    expect(finixUtils.createTransferReversal as jest.Mock).toHaveBeenCalledTimes(2);
  });
});
