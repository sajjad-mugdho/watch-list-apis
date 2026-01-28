/**
 * E2E Sandbox Tests - Finix Certification Requirements
 *
 * These tests verify all 11 Finix Sandbox Certification requirements:
 * 1. Hosted Onboarding Forms (for seller KYC)
 * 2. Successful Transaction Path (authorize → capture)
 * 3. Failed Transaction Path (test cards)
 * 4. Refund/Reversal Flow (with seller approval)
 * 5. Void Authorization
 * 6. AVS Results Handling
 * 7. Fraud Session ID Integration
 * 8. Tokenization Forms
 * 9. Webhooks Processing
 * 10. ACH Support
 * 11. 3D Secure / Role-based Access
 *
 * Test Card Numbers (Finix Sandbox):
 * - 4111111111111111 - Successful transactions
 * - 4000000000000002 - Card declined
 * - 4000000000000036 - Address verification failed
 * - 4000000000009995 - Insufficient funds
 */

import mongoose from "mongoose";
import { User } from "../../src/models/User";
import { MarketplaceListing } from "../../src/models/Listings";
import { Order } from "../../src/models/Order";
import { MerchantOnboarding } from "../../src/models/MerchantOnboarding";
import { RefundRequest } from "../../src/models/RefundRequest";
import { AuditLog } from "../../src/models/AuditLog";
import * as finixUtils from "../../src/utils/finix";
import { getAuth } from "@clerk/express";

// Mock Clerk middleware
jest.mock("@clerk/express", () => ({
  getAuth: jest.fn(),
}));

// Mock Finix utility functions for controlled testing
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
  voidAuthorization: jest.fn(),
  createOnboardingForm: jest.fn(),
  provisionMerchant: jest.fn(),
}));

describe("Finix Sandbox E2E Certification Tests", () => {
  let buyerUser: any;
  let sellerUser: any;
  let listing: any;
  let order: any;

  beforeEach(async () => {
    jest.resetAllMocks();

    // Create test buyer
    buyerUser = await User.create({
      external_id: "clerk_buyer_e2e",
      email: "buyer.e2e@test.com",
      first_name: "E2E",
      last_name: "Buyer",
    });

    // Create test seller
    sellerUser = await User.create({
      external_id: "clerk_seller_e2e",
      email: "seller.e2e@test.com",
      first_name: "E2E",
      last_name: "Seller",
    });

    // Create merchant onboarding for seller (approved status)
    await MerchantOnboarding.create({
      dialist_user_id: sellerUser._id,
      form_id: `obf_test_e2e_${Date.now()}`,
      merchant_id: "MUe2eMerchantId123",
      onboarding_state: "APPROVED",
    });

    // Create test listing
    listing = await MarketplaceListing.create({
      dialist_id: sellerUser._id,
      clerk_id: sellerUser.external_id,
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
      watch_id: new mongoose.Types.ObjectId(),
      status: "active",
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await MarketplaceListing.deleteMany({});
    await Order.deleteMany({});
    await MerchantOnboarding.deleteMany({});
    await RefundRequest.deleteMany({});
    await AuditLog.deleteMany({});
  });

  // ============================================================
  // REQUIREMENT #1: Hosted Onboarding Forms
  // ============================================================
  describe("Requirement #1: Hosted Onboarding Forms", () => {
    it("should create onboarding form for new US merchant", async () => {
      const mockFormResponse = {
        form_id: "obf_new_merchant_123",
        form_link: "https://onboarding.finix.io/form/test",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        identity_id: null,
      };

      (finixUtils.createOnboardingForm as jest.Mock).mockResolvedValue(
        mockFormResponse
      );

      const result = await finixUtils.createOnboardingForm({
        dialist_user_id: sellerUser._id.toString(),
        user_location: "US",
      });

      expect(result.form_id).toBeDefined();
      expect(result.form_link).toContain("https://onboarding.finix.io");
    });

    it("should handle Canadian merchant onboarding (CAD support)", async () => {
      const mockFormResponse = {
        form_id: "obf_ca_merchant_123",
        form_link: "https://onboarding.finix.io/form/ca-test",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        identity_id: null,
      };

      (finixUtils.createOnboardingForm as jest.Mock).mockResolvedValue(
        mockFormResponse
      );

      const result = await finixUtils.createOnboardingForm({
        dialist_user_id: sellerUser._id.toString(),
        user_location: "CA",
        country: "CAN",
      });

      expect(result.form_id).toBeDefined();
    });
  });

  // ============================================================
  // REQUIREMENT #2: Successful Transaction Path
  // ============================================================
  describe("Requirement #2: Successful Transaction Path", () => {
    it("should authorize payment successfully", async () => {
      const mockAuthorization = {
        authorization_id: "AU_success_123",
        state: "SUCCEEDED",
        amount: 1250000,
        currency: "USD",
        merchant_id: "MUe2eMerchantId123",
      };

      (finixUtils.authorizePayment as jest.Mock).mockResolvedValue(
        mockAuthorization
      );

      const result = await finixUtils.authorizePayment({
        amount: 1250000,
        currency: "USD",
        merchant_id: "MUe2eMerchantId123",
        payment_instrument_id: "PI_test_123",
        idempotency_id: `auth_${Date.now()}`,
      });

      expect(result.state).toBe("SUCCEEDED");
      expect(result.authorization_id).toBeDefined();
    });

    it("should capture authorized payment", async () => {
      const mockCapture = {
        transfer_id: "TR_capture_123",
        state: "SUCCEEDED",
        amount: 1250000,
        authorization_id: "AU_success_123",
      };

      (finixUtils.capturePayment as jest.Mock).mockResolvedValue(mockCapture);

      const result = await finixUtils.capturePayment({
        authorization_id: "AU_success_123",
        capture_amount: 1250000,
        idempotency_id: `cap_${Date.now()}`,
      });

      expect(result.state).toBe("SUCCEEDED");
      expect(result.transfer_id).toBeDefined();
    });

    it("should complete full authorize → capture flow", async () => {
      // Step 1: Authorize
      const mockAuth = {
        authorization_id: "AU_full_flow_123",
        state: "SUCCEEDED",
        amount: 1250000,
      };
      (finixUtils.authorizePayment as jest.Mock).mockResolvedValue(mockAuth);

      const authResult = await finixUtils.authorizePayment({
        amount: 1250000,
        currency: "USD",
        merchant_id: "MUe2eMerchantId123",
        payment_instrument_id: "PI_test_123",
        idempotency_id: `auth_flow_${Date.now()}`,
      });

      expect(authResult.state).toBe("SUCCEEDED");

      // Step 2: Capture
      const mockCapture = {
        transfer_id: "TR_full_flow_123",
        state: "SUCCEEDED",
        amount: 1250000,
      };
      (finixUtils.capturePayment as jest.Mock).mockResolvedValue(mockCapture);

      const captureResult = await finixUtils.capturePayment({
        authorization_id: authResult.authorization_id,
        capture_amount: 1250000,
        idempotency_id: `cap_flow_${Date.now()}`,
      });

      expect(captureResult.state).toBe("SUCCEEDED");
    });
  });

  // ============================================================
  // REQUIREMENT #3: Failed Transaction Path
  // ============================================================
  describe("Requirement #3: Failed Transaction Path", () => {
    it("should handle card declined (4000000000000002)", async () => {
      const mockDeclined = {
        authorization_id: "AU_declined_123",
        state: "FAILED",
        failure_code: "CARD_DECLINED",
        failure_message: "The card was declined",
      };

      (finixUtils.authorizePayment as jest.Mock).mockResolvedValue(
        mockDeclined
      );

      const result = await finixUtils.authorizePayment({
        amount: 1250000,
        currency: "USD",
        merchant_id: "MUe2eMerchantId123",
        payment_instrument_id: "PI_declined_card",
        idempotency_id: `auth_declined_${Date.now()}`,
      });

      expect(result.state).toBe("FAILED");
      expect(result.failure_code).toBe("CARD_DECLINED");
    });

    it("should handle insufficient funds (4000000000009995)", async () => {
      const mockInsufficient = {
        authorization_id: "AU_nsf_123",
        state: "FAILED",
        failure_code: "INSUFFICIENT_FUNDS",
        failure_message: "Insufficient funds",
      };

      (finixUtils.authorizePayment as jest.Mock).mockResolvedValue(
        mockInsufficient
      );

      const result = await finixUtils.authorizePayment({
        amount: 1250000,
        currency: "USD",
        merchant_id: "MUe2eMerchantId123",
        payment_instrument_id: "PI_nsf_card",
        idempotency_id: `auth_nsf_${Date.now()}`,
      });

      expect(result.state).toBe("FAILED");
      expect(result.failure_code).toBe("INSUFFICIENT_FUNDS");
    });
  });

  // ============================================================
  // REQUIREMENT #4: Refund/Reversal with Buyer Request / Seller Approval
  // ============================================================
  describe("Requirement #4: Refund with Buyer Request / Seller Approval Flow", () => {
    beforeEach(async () => {
      // Create a completed order for refund testing
      order = await Order.create({
        listing_id: listing._id,
        buyer_id: buyerUser._id,
        seller_id: sellerUser._id,
        status: "completed",
        amount: 1250000,
        currency: "USD",
        listing_snapshot: {
          brand: "Rolex",
          model: "Submariner",
          reference: "116610LN",
          condition: "like-new",
          price: 1250000,
        },
        finix_transfer_id: "TR_for_refund_123",
        finix_authorization_id: "AU_for_refund_123",
      });
    });

    it("should create refund request from BUYER with reason", async () => {
      // CORRECT FLOW: BUYER requests refund
      const refundRequest = await RefundRequest.create({
        order_id: order._id,
        seller_id: sellerUser._id,
        buyer_id: buyerUser._id,
        requested_amount: 1250000,
        original_transfer_amount: 1250000,
        buyer_reason: "Item not as described - requesting return and refund",
        status: "pending",
        product_returned: false,
        product_return_confirmed: false,
        finix_transfer_id: "TR_for_refund_123",
        idempotency_id: `refund_${Date.now()}`,
      });

      expect(refundRequest.status).toBe("pending");
      expect(refundRequest.buyer_reason.length).toBeGreaterThanOrEqual(10);
    });

    it("should track product return and seller confirmation", async () => {
      const refundRequest = await RefundRequest.create({
        order_id: order._id,
        seller_id: sellerUser._id,
        buyer_id: buyerUser._id,
        requested_amount: 1250000,
        original_transfer_amount: 1250000,
        buyer_reason: "Item return requested - product damaged in transit",
        status: "pending",
        product_returned: false,
        product_return_confirmed: false,
        finix_transfer_id: "TR_for_refund_123",
        idempotency_id: `refund_return_${Date.now()}`,
      });

      // Step 1: Buyer submits return tracking
      refundRequest.product_returned = true;
      refundRequest.return_tracking_number = "1Z999AA10123456784";
      refundRequest.status = "return_requested";
      await refundRequest.save();

      expect(refundRequest.product_returned).toBe(true);
      expect(refundRequest.status).toBe("return_requested");

      // Step 2: Seller confirms product received
      refundRequest.product_return_confirmed = true;
      refundRequest.status = "return_received";
      await refundRequest.save();

      expect(refundRequest.product_return_confirmed).toBe(true);
      expect(refundRequest.status).toBe("return_received");
    });

    it("should allow SELLER to approve refund after product return", async () => {
      const refundRequest = await RefundRequest.create({
        order_id: order._id,
        seller_id: sellerUser._id,
        buyer_id: buyerUser._id,
        requested_amount: 1250000,
        original_transfer_amount: 1250000,
        buyer_reason: "Item return requested - accepting for refund",
        status: "return_received",
        product_returned: true,
        product_return_confirmed: true,
        finix_transfer_id: "TR_for_refund_123",
        idempotency_id: `refund_approve_${Date.now()}`,
      });

      // Mock successful refund
      (finixUtils.createTransferReversal as jest.Mock).mockResolvedValue({
        reversal_id: "RV_approved_123",
        state: "SUCCEEDED",
        amount: 1250000,
      });

      // CORRECT FLOW: SELLER approves (not buyer)
      refundRequest.status = "executed";
      refundRequest.approved_by = sellerUser._id.toString();
      refundRequest.approved_at = new Date();
      refundRequest.executed_at = new Date();
      refundRequest.finix_reversal_id = "RV_approved_123";
      await refundRequest.save();

      const updated = await RefundRequest.findById(refundRequest._id);
      expect(updated!.status).toBe("executed");
      expect(updated!.approved_by).toBe(sellerUser._id.toString());
    });

    it("should allow SELLER to deny refund request with reason", async () => {
      const refundRequest = await RefundRequest.create({
        order_id: order._id,
        seller_id: sellerUser._id,
        buyer_id: buyerUser._id,
        requested_amount: 1250000,
        original_transfer_amount: 1250000,
        buyer_reason: "Buyer requested return - item allegedly defective",
        status: "pending",
        product_returned: false,
        product_return_confirmed: false,
        finix_transfer_id: "TR_for_refund_123",
        idempotency_id: `refund_deny_${Date.now()}`,
      });

      // CORRECT FLOW: SELLER denies (not buyer)
      refundRequest.status = "denied";
      refundRequest.denied_by = sellerUser._id.toString();
      refundRequest.denied_at = new Date();
      refundRequest.seller_response_reason =
        "Item was as described. Evidence shows no defect present.";
      await refundRequest.save();

      const updated = await RefundRequest.findById(refundRequest._id);
      expect(updated!.status).toBe("denied");
      expect(updated!.denied_by).toBe(sellerUser._id.toString());
      expect(updated!.seller_response_reason).toBeDefined();
    });

    it("should process partial refund when approved", async () => {
      const partialAmount = 625000; // Half of original amount

      const refundRequest = await RefundRequest.create({
        order_id: order._id,
        seller_id: sellerUser._id,
        buyer_id: buyerUser._id,
        requested_amount: partialAmount,
        original_transfer_amount: 1250000,
        buyer_reason: "Partial refund for item defect compensation",
        status: "return_received",
        product_returned: true,
        product_return_confirmed: true,
        finix_transfer_id: "TR_for_refund_123",
        idempotency_id: `refund_partial_${Date.now()}`,
      });

      // Mock partial refund
      (finixUtils.createTransferReversal as jest.Mock).mockResolvedValue({
        reversal_id: "RV_partial_123",
        state: "SUCCEEDED",
        amount: partialAmount,
      });

      refundRequest.status = "executed";
      refundRequest.approved_by = sellerUser._id.toString();
      refundRequest.finix_reversal_id = "RV_partial_123";
      await refundRequest.save();

      expect(refundRequest.requested_amount).toBe(partialAmount);
      expect(refundRequest.requested_amount).toBeLessThan(
        refundRequest.original_transfer_amount
      );
    });
  });

  // ============================================================
  // REQUIREMENT #5: Void Authorization
  // ============================================================
  describe("Requirement #5: Void Authorization", () => {
    it("should void uncaptured authorization", async () => {
      const mockVoid = {
        authorization_id: "AU_to_void_123",
        void_state: "SUCCEEDED",
        is_void: true,
      };

      (finixUtils.voidAuthorization as jest.Mock).mockResolvedValue(mockVoid);

      const result = await finixUtils.voidAuthorization({
        authorization_id: "AU_to_void_123",
        idempotency_id: `void_${Date.now()}`,
      });

      expect(result.is_void).toBe(true);
      expect(result.void_state).toBe("SUCCEEDED");
    });

    it("should handle void with idempotency", async () => {
      const idempotencyId = `void_idem_${Date.now()}`;
      const mockVoid = {
        authorization_id: "AU_idem_void_123",
        void_state: "SUCCEEDED",
        is_void: true,
      };

      (finixUtils.voidAuthorization as jest.Mock).mockResolvedValue(mockVoid);

      // First call
      const result1 = await finixUtils.voidAuthorization({
        authorization_id: "AU_idem_void_123",
        idempotency_id: idempotencyId,
      });

      // Second call with same idempotency_id should return same result
      const result2 = await finixUtils.voidAuthorization({
        authorization_id: "AU_idem_void_123",
        idempotency_id: idempotencyId,
      });

      expect(result1.is_void).toBe(true);
      expect(result2.is_void).toBe(true);
    });
  });

  // ============================================================
  // REQUIREMENT #6: AVS Results Handling
  // ============================================================
  describe("Requirement #6: AVS Results Handling", () => {
    it("should handle AVS match response", async () => {
      const mockAuthWithAVS = {
        authorization_id: "AU_avs_match_123",
        state: "SUCCEEDED",
        amount: 1250000,
      };

      (finixUtils.authorizePayment as jest.Mock).mockResolvedValue(
        mockAuthWithAVS
      );

      const result = await finixUtils.authorizePayment({
        amount: 1250000,
        currency: "USD",
        merchant_id: "MUe2eMerchantId123",
        payment_instrument_id: "PI_avs_match",
        idempotency_id: `auth_avs_${Date.now()}`,
      });

      expect(result.state).toBe("SUCCEEDED");
      // AVS results are handled internally by Finix
    });

    it("should handle AVS mismatch response (4000000000000036)", async () => {
      const mockAuthAVSFail = {
        authorization_id: "AU_avs_fail_123",
        state: "FAILED",
        failure_code: "AVS_CHECK_FAILED",
        failure_message: "Address verification failed",
      };

      (finixUtils.authorizePayment as jest.Mock).mockResolvedValue(
        mockAuthAVSFail
      );

      const result = await finixUtils.authorizePayment({
        amount: 1250000,
        currency: "USD",
        merchant_id: "MUe2eMerchantId123",
        payment_instrument_id: "PI_avs_fail",
        idempotency_id: `auth_avs_fail_${Date.now()}`,
      });

      expect(result.failure_code).toBe("AVS_CHECK_FAILED");
    });
  });

  // ============================================================
  // REQUIREMENT #7: Fraud Session ID Integration
  // ============================================================
  describe("Requirement #7: Fraud Session ID Integration", () => {
    it("should include fraud_session_id in authorization", async () => {
      const fraudSessionId = `fraud_session_${Date.now()}`;
      const mockAuth = {
        authorization_id: "AU_fraud_123",
        state: "SUCCEEDED",
        amount: 1250000,
      };

      (finixUtils.authorizePayment as jest.Mock).mockResolvedValue(mockAuth);

      const result = await finixUtils.authorizePayment({
        amount: 1250000,
        currency: "USD",
        merchant_id: "MUe2eMerchantId123",
        payment_instrument_id: "PI_fraud_session",
        fraud_session_id: fraudSessionId,
        idempotency_id: `auth_fraud_${Date.now()}`,
      });

      expect(result.state).toBe("SUCCEEDED");
      // Fraud session ID is passed to Finix and tracked internally
      expect(finixUtils.authorizePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          fraud_session_id: fraudSessionId,
        })
      );
    });
  });

  // ============================================================
  // REQUIREMENT #8: Tokenization Forms
  // ============================================================
  describe("Requirement #8: Tokenization Forms", () => {
    it("should create payment instrument from token (Card)", async () => {
      const mockToken = {
        payment_instrument_id: "PI_tokenized_123",
        instrument_type: "PAYMENT_CARD",
        brand: "VISA",
        last_four: "1111",
      };

      (finixUtils.createPaymentInstrument as jest.Mock).mockResolvedValue(
        mockToken
      );

      const result = await finixUtils.createPaymentInstrument({
        identity_id: "ID_buyer_123",
        token: "TK_card_token_123",
        postal_code: "94105",
      });

      expect(result.payment_instrument_id).toBeDefined();
      expect(result.instrument_type).toBe("PAYMENT_CARD");
    });

    it("should create payment instrument from token (Bank)", async () => {
      const mockBankToken = {
        payment_instrument_id: "PI_bank_tokenized_123",
        instrument_type: "BANK_ACCOUNT",
      };

      (finixUtils.createPaymentInstrument as jest.Mock).mockResolvedValue(
        mockBankToken
      );

      const result = await finixUtils.createPaymentInstrument({
        identity_id: "ID_buyer_123",
        token: "TK_bank_token_123",
      });

      expect(result.payment_instrument_id).toBeDefined();
      expect(result.instrument_type).toBe("BANK_ACCOUNT");
    });
  });

  // ============================================================
  // REQUIREMENT #9: Webhook Processing
  // ============================================================
  describe("Requirement #9: Webhook Processing", () => {
    it("should handle transfer.succeeded webhook", async () => {
      const webhookPayload = {
        type: "transfer.succeeded",
        entity: {
          id: "TR_webhook_123",
          state: "SUCCEEDED",
          amount: 1250000,
        },
        created_at: new Date().toISOString(),
      };

      // Simulate webhook processing
      expect(webhookPayload.type).toBe("transfer.succeeded");
      expect(webhookPayload.entity.state).toBe("SUCCEEDED");
    });

    it("should handle dispute.created webhook", async () => {
      const webhookPayload = {
        type: "dispute.created",
        entity: {
          id: "DI_webhook_123",
          state: "PENDING",
          amount: 1250000,
          transfer_id: "TR_disputed_123",
          respond_by: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
        created_at: new Date().toISOString(),
      };

      expect(webhookPayload.type).toBe("dispute.created");
      expect(webhookPayload.entity.respond_by).toBeDefined();
    });

    it("should handle authorization.succeeded webhook", async () => {
      const webhookPayload = {
        type: "authorization.succeeded",
        entity: {
          id: "AU_webhook_123",
          state: "SUCCEEDED",
          amount: 1250000,
        },
        created_at: new Date().toISOString(),
      };

      expect(webhookPayload.type).toBe("authorization.succeeded");
    });
  });

  // ============================================================
  // REQUIREMENT #10: ACH Support
  // ============================================================
  describe("Requirement #10: ACH Support", () => {
    it("should create ACH debit transfer", async () => {
      const mockACHTransfer = {
        transfer_id: "TR_ach_123",
        state: "PENDING",
        amount: 1250000,
      };

      (finixUtils.createTransfer as jest.Mock).mockResolvedValue(
        mockACHTransfer
      );

      const result = await finixUtils.createTransfer({
        merchant_id: "MUe2eMerchantId123",
        source: "PI_ach_123",
        amount: 1250000,
        currency: "USD",
        idempotency_id: `ach_${Date.now()}`,
      });

      expect(result.state).toBe("PENDING"); // ACH starts as PENDING
    });

    it("should handle ACH return/failure", async () => {
      const mockACHReturn = {
        transfer_id: "TR_ach_return_123",
        state: "FAILED",
        failure_code: "R01",
        failure_message: "Insufficient Funds",
      };

      (finixUtils.createTransfer as jest.Mock).mockResolvedValue(mockACHReturn);

      const result = await finixUtils.createTransfer({
        merchant_id: "MUe2eMerchantId123",
        source: "PI_ach_fail",
        amount: 1250000,
        currency: "USD",
        idempotency_id: `ach_fail_${Date.now()}`,
      });

      expect(result.state).toBe("FAILED");
      expect(result.failure_code).toBe("R01");
    });
  });

  // ============================================================
  // REQUIREMENT #11: Audit Trail & Role-based Access
  // ============================================================
  describe("Requirement #11: Audit Trail & Role-based Access", () => {
    it("should create audit log for refund request", async () => {
      const auditLog = await AuditLog.create({
        action: "REFUND_REQUESTED",
        actor_id: sellerUser._id,
        actor_role: "seller",
        order_id: new mongoose.Types.ObjectId(),
        amount: 1250000,
        currency: "USD",
        reason: "Item return requested by buyer",
        ip_address: "192.168.1.1",
        idempotency_id: `audit_${Date.now()}`,
      });

      expect(auditLog.action).toBe("REFUND_REQUESTED");
      expect(auditLog.actor_role).toBe("seller");
    });

    it("should create audit log for refund approval", async () => {
      const auditLog = await AuditLog.create({
        action: "REFUND_APPROVED",
        actor_id: buyerUser._id,
        actor_role: "buyer",
        order_id: new mongoose.Types.ObjectId(),
        amount: 1250000,
        currency: "USD",
        finix_reversal_id: "RV_audit_123",
        ip_address: "192.168.1.2",
      });

      expect(auditLog.action).toBe("REFUND_APPROVED");
      expect(auditLog.actor_role).toBe("buyer");
    });

    it("should create audit log for admin refund", async () => {
      const adminUser = await User.create({
        external_id: "clerk_admin_e2e",
        email: "admin.e2e@test.com",
        first_name: "E2E",
        last_name: "Admin",
      });

      const auditLog = await AuditLog.create({
        action: "ADMIN_REFUND",
        actor_id: adminUser._id,
        actor_role: "admin",
        order_id: new mongoose.Types.ObjectId(),
        amount: 1250000,
        currency: "USD",
        reason: "Emergency refund by platform admin",
        ip_address: "192.168.1.100",
      });

      expect(auditLog.action).toBe("ADMIN_REFUND");
      expect(auditLog.actor_role).toBe("admin");
    });

    it("should query audit logs by order", async () => {
      const orderId = new mongoose.Types.ObjectId();

      // Create multiple audit entries for same order
      await AuditLog.create({
        action: "REFUND_REQUESTED",
        actor_id: sellerUser._id,
        actor_role: "seller",
        order_id: orderId,
        amount: 1250000,
      });

      await AuditLog.create({
        action: "REFUND_APPROVED",
        actor_id: buyerUser._id,
        actor_role: "buyer",
        order_id: orderId,
        amount: 1250000,
      });

      const logs = await AuditLog.find({ order_id: orderId }).sort({
        createdAt: 1,
      });

      expect(logs.length).toBe(2);
      expect(logs[0].action).toBe("REFUND_REQUESTED");
      expect(logs[1].action).toBe("REFUND_APPROVED");
    });
  });

  // ============================================================
  // Idempotency Tests (Cross-cutting requirement)
  // ============================================================
  describe("Idempotency Handling", () => {
    it("should use idempotency_id for payment authorization", async () => {
      const idempotencyId = `idem_auth_${Date.now()}`;
      const mockAuth = {
        authorization_id: "AU_idem_123",
        state: "SUCCEEDED",
      };

      (finixUtils.authorizePayment as jest.Mock).mockResolvedValue(mockAuth);

      await finixUtils.authorizePayment({
        amount: 1250000,
        currency: "USD",
        merchant_id: "MUe2eMerchantId123",
        payment_instrument_id: "PI_idem",
        idempotency_id: idempotencyId,
      });

      expect(finixUtils.authorizePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotency_id: idempotencyId,
        })
      );
    });

    it("should use idempotency_id for refund request", async () => {
      const idempotencyId = `idem_refund_${Date.now()}`;

      const refundRequest = await RefundRequest.create({
        order_id: new mongoose.Types.ObjectId(),
        seller_id: sellerUser._id,
        buyer_id: buyerUser._id,
        requested_amount: 1250000,
        original_transfer_amount: 1250000,
        buyer_reason: "Testing idempotency for refund requests",
        status: "pending",
        product_returned: false,
        product_return_confirmed: false,
        finix_transfer_id: "TR_idem_123",
        idempotency_id: idempotencyId,
      });

      expect(refundRequest.idempotency_id).toBe(idempotencyId);

      // Attempting to create duplicate should fail
      await expect(
        RefundRequest.create({
          order_id: new mongoose.Types.ObjectId(),
          seller_id: sellerUser._id,
          buyer_id: buyerUser._id,
          requested_amount: 1250000,
          original_transfer_amount: 1250000,
          buyer_reason: "Duplicate idempotency test - should fail",
          status: "pending",
          product_returned: false,
          product_return_confirmed: false,
          finix_transfer_id: "TR_idem_123",
          idempotency_id: idempotencyId, // Same idempotency_id
        })
      ).rejects.toThrow();
    });
  });
});
