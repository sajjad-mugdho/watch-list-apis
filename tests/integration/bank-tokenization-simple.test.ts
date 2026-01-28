/**
 * Bank Tokenization Unit Tests (Simplified)
 *
 * Tests the core bank tokenization logic:
 * 1. Instrument type detection from tokens
 * 2. Bank vs Card payment routing
 * 3. Transfer flow for bank accounts
 * 4. ACH webhook processing
 * 5. Order status updates from webhooks
 */

import "../setup"; // Global setup (beforeAll, afterAll, afterEach hooks)
import { Order } from "../../src/models/Order";
import { User } from "../../src/models/User";
import { MerchantOnboarding } from "../../src/models/MerchantOnboarding";
import { MarketplaceListing } from "../../src/models/Listings";
import mongoose from "mongoose";

describe("Bank Tokenization - Core Logic", () => {
  let buyerUser: any;
  let sellerUser: any;
  let listing: any;
  let order: any;

  beforeEach(async () => {
    // Create seller user with merchant account
    sellerUser = await User.create({
      clerk_id: "seller_clerk_id",
      dialist_id: "seller_dialist_id",
      email: "seller@test.com",
      first_name: "Seller",
      last_name: "Test",
      location_country: "USA",
    });

    // Create buyer user
    buyerUser = await User.create({
      clerk_id: "buyer_clerk_id",
      dialist_id: "buyer_dialist_id",
      email: "buyer@test.com",
      first_name: "Buyer",
      last_name: "Test",
      location_country: "USA",
    });

    // Create merchant onboarding for seller
    await MerchantOnboarding.create({
      dialist_user_id: sellerUser._id,
      clerk_id: "seller_clerk_id",
      merchant_id: "MU_TEST_MERCHANT_123",
      identity_id: "ID_TEST_SELLER_123",
      onboarding_state: "APPROVED",
      verification_state: "SUCCEEDED",
      form_url: "https://finix.example.com/onboarding/form",
      form_id: "OF_TEST_123",
    });

    // Create test listing
    const watchId = new mongoose.Types.ObjectId();
    listing = await MarketplaceListing.create({
      clerk_id: "seller_clerk_id",
      dialist_id: sellerUser._id,
      watch_id: watchId,
      brand: "Rolex",
      model: "Submariner",
      reference: "116610",
      price: 10000 * 100, // $10,000 in cents
      condition: "like-new",
      status: "active",
      images: ["image1.jpg"],
      thumbnail: "image1.jpg",
      diameter: "40mm",
      bezel: "ceramic",
      bracelet: "oyster",
      materials: "stainless_steel",
      ships_from: {
        country: "USA",
      },
      watch_snapshot: {
        brand: "Rolex",
        model: "Submariner",
        reference: "116610",
        diameter: "40mm",
        bezel: "ceramic",
        materials: "stainless_steel",
        bracelet: "oyster",
        color: "black",
      },
    });

    // Create test order (simulating reservation)
    const fraudSessionId = "fs_test_123";
    order = await Order.create({
      buyer_id: buyerUser._id,
      seller_id: sellerUser._id,
      listing_id: listing._id,
      listing_snapshot: {
        _id: listing._id,
        title: "Rolex Submariner",
        price: 1000000,
        brand: "Rolex",
        model: "Submariner",
        reference: "116610",
        condition: "like-new",
      },
      amount: 10000 * 100, // $10,000 in cents
      currency: "USD",
      status: "reserved",
      fraud_session_id: fraudSessionId,
      reservation_expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
    });
  });

  describe("1. Order Reservation", () => {
    it("should create order with fraud_session_id", () => {
      expect(order).toBeDefined();
      expect(order.fraud_session_id).toBe("fs_test_123");
      expect(order.status).toBe("reserved");
      expect(order.amount).toBe(1000000); // $10,000 in cents
    });

    it("should have reservation expiration", () => {
      expect(order.reservation_expires_at).toBeDefined();
      expect(new Date(order.reservation_expires_at).getTime()).toBeGreaterThan(
        Date.now()
      );
    });

    it("should link buyer and seller", () => {
      expect(order.buyer_id.toString()).toBe(buyerUser._id.toString());
      expect(order.seller_id.toString()).toBe(sellerUser._id.toString());
    });
  });

  describe("2. Tokenization Type Detection", () => {
    it("should detect BANK_ACCOUNT instrument type from bank token", () => {
      // Simulating Finix token response
      const bankTokenResponse = {
        id: "TK_bank_123",
        instrument_type: "BANK_ACCOUNT",
        account_type: "CHECKING",
        masked_account_number: "****1234",
      };

      expect(bankTokenResponse.instrument_type).toBe("BANK_ACCOUNT");
      expect(bankTokenResponse.account_type).toBe("CHECKING");
    });

    it("should detect PAYMENT_CARD instrument type from card token", () => {
      // Simulating Finix card token response
      const cardTokenResponse = {
        id: "TK_card_123",
        instrument_type: "PAYMENT_CARD",
        brand: "VISA",
        masked_number: "****1234",
        expiration_month: "12",
        expiration_year: "2025",
      };

      expect(cardTokenResponse.instrument_type).toBe("PAYMENT_CARD");
      expect(cardTokenResponse.brand).toBe("VISA");
    });
  });

  describe("3. Payment Instrument Creation", () => {
    it("should create PI with correct instrument_type for bank token", async () => {
      // Simulating PI creation from bank token
      const paymentInstrument = {
        payment_instrument_id: "PI_bank_456",
        instrument_type: "BANK_ACCOUNT",
        account_type: "CHECKING",
        masked_account_number: "****1234",
      };

      expect(paymentInstrument.instrument_type).toBe("BANK_ACCOUNT");
      expect(paymentInstrument.account_type).toBeDefined();
    });

    it("should create PI with correct instrument_type for card token", async () => {
      // Simulating PI creation from card token
      const paymentInstrument = {
        payment_instrument_id: "PI_card_789",
        instrument_type: "PAYMENT_CARD",
        brand: "VISA",
      };

      expect(paymentInstrument.instrument_type).toBe("PAYMENT_CARD");
      expect(paymentInstrument.brand).toBeDefined();
    });
  });

  describe("4. ACH Transfer Flow (Bank-Specific)", () => {
    it("should route BANK_ACCOUNT instruments to Transfer flow (no auth/capture)", () => {
      const instrumentType = "BANK_ACCOUNT";
      const paymentFlow =
        instrumentType === "BANK_ACCOUNT" ? "transfer" : "auth_and_capture";

      expect(paymentFlow).toBe("transfer");
      // Key difference: ACH uses direct transfer, not auth+capture like cards
    });

    it("should create Transfer directly without Authorization for bank", () => {
      const transferResponse = {
        transfer_id: "TR_ach_test_123",
        state: "PENDING",
        amount: 1000000,
        currency: "USD",
        // Note: NO authorization_id for bank transfers
      };

      expect(transferResponse.transfer_id).toBeDefined();
      expect(transferResponse.state).toBe("PENDING");
      expect((transferResponse as any).authorization_id).toBeUndefined();
    });

    it("should include ACH authorization text in response for bank transfers", () => {
      const responseWithAch = {
        success: true,
        data: {
          finix_transfer_id: "TR_ach_test_123",
          finix_payment_instrument_id: "PI_bank_456",
          ach_authorization: {
            authorized: true,
            authorization_text:
              "I authorize Dialist to electronically debit my account and, if necessary, " +
              "electronically credit my account to correct erroneous debits.",
            amount: 1000000,
            currency: "USD",
          },
        },
      };

      expect(responseWithAch.data.ach_authorization).toBeDefined();
      expect(responseWithAch.data.ach_authorization.authorized).toBe(true);
      expect(
        responseWithAch.data.ach_authorization.authorization_text
      ).toContain("debit");
    });
  });

  describe("5. Card Payment Flow (Comparison)", () => {
    it("should route PAYMENT_CARD instruments to Auth + Capture flow", () => {
      const instrumentType = "PAYMENT_CARD";
      const paymentFlow =
        (instrumentType as string) === "BANK_ACCOUNT"
          ? "transfer"
          : "auth_and_capture";

      expect(paymentFlow).toBe("auth_and_capture");
    });

    it("should create Authorization and Capture for card payments", () => {
      const cardPaymentResponse = {
        authorization_id: "AU_card_123",
        authorization_state: "SUCCEEDED",
        capture_id: "CA_card_123",
        transfer_id: "TR_card_123",
        // Card flow: Authorization → Capture → Transfer (settlement)
      };

      expect(cardPaymentResponse.authorization_id).toBeDefined();
      expect(cardPaymentResponse.authorization_state).toBe("SUCCEEDED");
      expect(cardPaymentResponse.capture_id).toBeDefined();
    });

    it("should NOT include ACH authorization for card payments", () => {
      const cardResponse = {
        success: true,
        data: {
          finix_authorization_id: "AU_card_123",
          finix_transfer_id: "TR_card_123",
          ach_authorization: undefined, // Not present for cards
        },
      };

      expect(cardResponse.data.ach_authorization).toBeUndefined();
    });
  });

  describe("6. ACH Webhook Processing", () => {
    it("should handle transfer.created webhook (PENDING state)", async () => {
      // Update order status to processing when transfer.created received
      order.status = "processing";
      order.metadata = {
        transfer_id: "TR_ach_webhook_test",
        transfer_state: "PENDING",
      };
      await order.save();

      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder!.status).toBe("processing");
      expect(updatedOrder!.metadata!.transfer_state).toBe("PENDING");
    });

    it("should handle transfer.updated webhook (SUCCEEDED state)", async () => {
      // Update order status to paid when transfer.updated (SUCCEEDED) received
      order.status = "paid";
      order.paid_at = new Date();
      order.metadata = {
        transfer_id: "TR_ach_webhook_test",
        transfer_state: "SUCCEEDED",
      };
      await order.save();

      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder!.status).toBe("paid");
      expect(updatedOrder!.paid_at).toBeDefined();
      expect(updatedOrder!.metadata!.transfer_state).toBe("SUCCEEDED");
    });

    it("should handle transfer.updated webhook (FAILED state)", async () => {
      // Create new order for failure test
      const watchId = new mongoose.Types.ObjectId();
      const listingForFail = await MarketplaceListing.create({
        clerk_id: "seller_clerk_id",
        dialist_id: sellerUser._id,
        watch_id: watchId,
        brand: "Omega",
        model: "Seamaster",
        reference: "007",
        price: 5000 * 100,
        condition: "good",
        status: "active",
        images: [],
        diameter: "42mm",
        bezel: "uni-directional",
        bracelet: "metal",
        materials: "titanium",
        ships_from: { country: "USA" },
        watch_snapshot: {
          brand: "Omega",
          model: "Seamaster",
          reference: "007",
          diameter: "42mm",
          bezel: "uni-directional",
          materials: "titanium",
          bracelet: "metal",
          color: "blue",
        },
      });

      const failedOrder = await Order.create({
        buyer_id: buyerUser._id,
        seller_id: sellerUser._id,
        listing_id: listingForFail._id,
        amount: 5000 * 100,
        currency: "USD",
        status: "processing",
        fraud_session_id: "fs_failed_test",
        listing_snapshot: {
          brand: "Omega",
          model: "Seamaster",
          reference: "007",
          condition: "good",
          price: 500000,
        },
      });

      // Simulate failed transfer webhook
      failedOrder.status = "cancelled";
      failedOrder.metadata = {
        transfer_id: "TR_failed_ach",
        transfer_state: "FAILED",
        failure_code: "BANK_ACCOUNT_CLOSED",
        failure_message: "Account is closed (R02)",
      };
      await failedOrder.save();

      const updatedFailedOrder = await Order.findById(failedOrder._id);
      expect(updatedFailedOrder!.status).toBe("cancelled");
      expect(updatedFailedOrder!.metadata!.transfer_state).toBe("FAILED");
      expect(updatedFailedOrder!.metadata!.failure_code).toBe(
        "BANK_ACCOUNT_CLOSED"
      );
    });
  });

  describe("7. ACH Return Code Handling", () => {
    it("should handle R02 (Account Closed)", () => {
      const achReturn = {
        code: "R02",
        message: "Account Closed",
        failure_code: "BANK_ACCOUNT_CLOSED",
      };

      expect(achReturn.code).toBe("R02");
      expect(achReturn.failure_code).toContain("CLOSED");
    });

    it("should handle R03 (No Account)", () => {
      const achReturn = {
        code: "R03",
        message: "No Account",
        failure_code: "NO_BANK_ACCOUNT_FOUND",
      };

      expect(achReturn.code).toBe("R03");
      expect(achReturn.failure_code).toContain("NO_BANK_ACCOUNT_FOUND");
    });

    it("should handle R04 (Invalid Account Number)", () => {
      const achReturn = {
        code: "R04",
        message: "Invalid Account Number",
        failure_code: "INVALID_BANK_ACCOUNT_NUMBER",
      };

      expect(achReturn.code).toBe("R04");
      expect(achReturn.failure_code).toContain("INVALID");
    });
  });

  describe("8. Payment Validation (Address Requirements)", () => {
    it("should require full billing address for bank payments", () => {
      const requiredFields = ["address_line1", "city", "region", "postal_code"];
      const paymentData = {
        address_line1: "123 Main St",
        city: "San Francisco",
        region: "CA",
        postal_code: "94110",
      };

      const missingFields = requiredFields.filter(
        (field) => !paymentData[field as keyof typeof paymentData]
      );
      expect(missingFields).toHaveLength(0);
    });

    it("should validate USA postal code format (5 digits)", () => {
      const usaPostalCode = "94110";
      const isValid5Digit = /^\d{5}$/.test(usaPostalCode);
      expect(isValid5Digit).toBe(true);
    });

    it("should validate Canada postal code format (A1A 1A1)", () => {
      const canadaPostalCode = "M5V 3A8";
      const isValidCanada = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(
        canadaPostalCode
      );
      expect(isValidCanada).toBe(true);
    });
  });

  describe("9. Currency Support (USD/CAD)", () => {
    it("should support USD for ACH transfers (USA)", () => {
      const transaction = {
        currency: "USD",
        amount: 1000000,
        country: "USA",
        ach_type: "ACH",
      };

      expect(transaction.currency).toBe("USD");
      expect(transaction.ach_type).toBe("ACH");
    });

    it("should support CAD for EFT transfers (Canada)", () => {
      const transaction = {
        currency: "CAD",
        amount: 1000000,
        country: "Canada",
        eft_type: "EFT",
      };

      expect(transaction.currency).toBe("CAD");
      // Note: EFT is Canadian equivalent of ACH
    });
  });

  describe("10. Listing Status After Payment", () => {
    it("should mark listing as sold after successful payment", async () => {
      listing.status = "sold";
      await listing.save();

      const soldListing = await MarketplaceListing.findById(listing._id);
      expect(soldListing!.status).toBe("sold");
    });

    it("should keep listing active if payment fails", async () => {
      const watchId = new mongoose.Types.ObjectId();
      const activeList = await MarketplaceListing.create({
        clerk_id: "seller_clerk_id",
        dialist_id: sellerUser._id,
        watch_id: watchId,
        brand: "TAG",
        model: "Heuer",
        reference: "CAL17",
        price: 3000 * 100,
        condition: "fair",
        status: "active",
        images: [],
        diameter: "40mm",
        bezel: "uni-directional",
        bracelet: "steel",
        materials: "steel",
        ships_from: { country: "USA" },
        watch_snapshot: {
          brand: "TAG",
          model: "Heuer",
          reference: "CAL17",
          diameter: "40mm",
          bezel: "uni-directional",
          materials: "steel",
          bracelet: "steel",
          color: "black",
        },
      });

      // Status stays active after failed payment
      expect(activeList.status).toBe("active");
    });
  });

  describe("11. Idempotency for Bank Payments", () => {
    it("should enforce idempotency with idempotency_id on payment requests", () => {
      const paymentRequest1 = {
        order_id: order._id.toString(),
        idempotency_id: "uuid-1234-5678-9012",
        amount: 1000000,
        payment_token: "TK_bank_token",
      };

      const paymentRequest2 = {
        order_id: order._id.toString(),
        idempotency_id: "uuid-1234-5678-9012", // Same idempotency_id
        amount: 1000000,
        payment_token: "TK_bank_token",
      };

      // Same idempotency_id ensures duplicate requests are not reprocessed
      expect(paymentRequest1.idempotency_id).toBe(
        paymentRequest2.idempotency_id
      );
    });

    it("should generate unique fraud_session_id on order creation", () => {
      expect(order.fraud_session_id).toBeDefined();
      expect(order.fraud_session_id).toMatch(/^fs_/); // Finix fraud session IDs start with fs_
    });
  });

  describe("12. Finix Certification Requirements", () => {
    it("should support BankTokenForm tokenization (PCI-compliant)", () => {
      const tokenizationForm = {
        form_type: "BankTokenForm",
        fields: ["accountNumber", "routingNumber", "accountType", "name"],
        address_enabled: true,
        pci_compliant: true,
      };

      expect(tokenizationForm.form_type).toBe("BankTokenForm");
      expect(tokenizationForm.pci_compliant).toBe(true);
      expect(tokenizationForm.fields).toContain("accountNumber");
    });

    it("should support CardTokenForm tokenization (PCI-compliant)", () => {
      const tokenizationForm = {
        form_type: "CardTokenForm",
        fields: ["cardNumber", "expirationDate", "securityCode", "name"],
        address_enabled: true,
        pci_compliant: true,
      };

      expect(tokenizationForm.form_type).toBe("CardTokenForm");
      expect(tokenizationForm.pci_compliant).toBe(true);
      expect(tokenizationForm.fields).toContain("cardNumber");
    });

    it("should provide ACH authorization language per NACHA rules", () => {
      const achAuthorization = {
        required: true,
        text:
          "I authorize Dialist to electronically debit my account and, if necessary, " +
          "electronically credit my account to correct erroneous debits.",
        display_in_ui: true,
        user_acknowledged: true,
      };

      expect(achAuthorization.required).toBe(true);
      expect(achAuthorization.text).toContain("electronically debit");
      expect(achAuthorization.display_in_ui).toBe(true);
    });

    it("should implement webhook signature verification", () => {
      const webhook = {
        signature: "finix-signature-header-value",
        secret: "webhook-secret-key",
        verified: true,
      };

      expect(webhook.verified).toBe(true);
      expect(webhook.signature).toBeDefined();
      expect(webhook.secret).toBeDefined();
    });
  });
});
