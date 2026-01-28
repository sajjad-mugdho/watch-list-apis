import mongoose from "mongoose";
import { User, IUser } from "../../src/models/User";
import { WebhookEvent, IWebhookEvent } from "../../src/models/WebhookEvent";
import Order, { IOrder } from "../../src/models/Order";

/**
 * Test fixtures for consistent test data
 */

// Base user data
export const mockUserData = {
  external_id: "user_test_clerk_123",
  email: "testuser@example.com",
  first_name: "Test",
  last_name: "User",
  location: {
    country: "US" as const,
    region: "California",
    city: "San Francisco",
    postal_code: "94102",
  },
  onboarding: {
    status: "completed" as const,
    version: "v1",
    steps: {
      location: {
        country: "US" as const,
        postal_code: "94102",
        region: "California",
        updated_at: new Date(),
      },
      display_name: {
        confirmed: true,
        value: "Test User",
        user_provided: true,
        updated_at: new Date(),
      },
      avatar: {
        confirmed: true,
        url: "https://images.dialist.com/test-avatar.jpg",
        user_provided: false,
        updated_at: new Date(),
      },
      acknowledgements: {
        tos: true,
        privacy: true,
        rules: true,
        updated_at: new Date(),
      },
    },
    completed_at: new Date(),
  },
};

// Merchant user (pending onboarding)
export const mockMerchantUserPending = {
  ...mockUserData,
  external_id: "user_merchant_pending_123",
  email: "merchant.pending@example.com",
  merchant: {
    onboarding_form_id: "obfTest_pending_123",
    identity_id: "IDtest_pending_123",
    merchant_id: null,
    verification_id: null,
    onboarding_state: "PROVISIONING" as const,
    verification_state: "PENDING" as const,
    onboarded_at: new Date(),
    verified_at: null,
  },
};

// Merchant user (approved)
export const mockMerchantUserApproved = {
  ...mockUserData,
  external_id: "user_merchant_approved_123",
  email: "merchant.approved@example.com",
  merchant: {
    onboarding_form_id: "obfTest_approved_123",
    identity_id: "IDtest_approved_123",
    merchant_id: "MU_test_123",
    verification_id: "VRtest_123",
    onboarding_state: "APPROVED" as const,
    verification_state: "SUCCEEDED" as const,
    onboarded_at: new Date(Date.now() - 86400000),
    verified_at: new Date(),
  },
};

// Finix webhook payloads
export const mockFinixWebhookOnboardingUpdated = (
  userId: string,
  formId: string,
  status: string = "APPROVED",
  merchantId: string = "MU_test_123"
) => ({
  entity: "onboarding_form",
  type: "updated",
  id: `evt_test_${Date.now()}`,
  occurred_at: new Date().toISOString(),
  _embedded: {
    onboarding_forms: [
      {
        id: formId,
        status,
        merchant_id: merchantId,
        tags: {
          dialist_user_id: userId,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
});

export const mockFinixWebhookOnboardingCreated = (formId: string) => ({
  entity: "onboarding_form",
  type: "created",
  id: `evt_test_created_${Date.now()}`,
  occurred_at: new Date().toISOString(),
  _embedded: {
    onboarding_forms: [
      {
        id: formId,
        status: "PENDING_SUBMISSION",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
});

export const mockFinixWebhookTransferCreated = (
  transferId: string,
  authorizationId: string,
  amount: number = 50000
) => ({
  entity: "transfer",
  type: "created",
  id: `evt_transfer_created_${Date.now()}`,
  occurred_at: new Date().toISOString(),
  _embedded: {
    transfers: [
      {
        id: transferId,
        amount,
        currency: "USD",
        state: "PENDING",
        merchant: "MU_test_merchant_123",
        source: "PI_payment_instrument_123",
        destination: "PI_destination_123",
        tags: {
          authorization_id: authorizationId,
          order_id: "mock_order_id",
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
});

export const mockFinixWebhookTransferUpdated = (
  transferId: string,
  state: "SUCCEEDED" | "FAILED" | "PENDING" | "CANCELED",
  failureCode?: string,
  failureMessage?: string
) => ({
  entity: "transfer",
  type: "updated",
  id: `evt_transfer_updated_${Date.now()}`,
  occurred_at: new Date().toISOString(),
  _embedded: {
    transfers: [
      {
        id: transferId,
        amount: 50000,
        currency: "USD",
        state,
        merchant: "MU_test_merchant_123",
        source: "PI_payment_instrument_123",
        destination: "PI_destination_123",
        ready_to_settle_at:
          state === "SUCCEEDED" ? new Date().toISOString() : null,
        failure_code: failureCode || null,
        failure_message: failureMessage || null,
        tags: {
          order_id: "mock_order_id",
        },
        created_at: new Date(Date.now() - 5000).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
});

export const mockFinixWebhookMerchantCreated = (
  merchantId: string,
  identityId: string,
  verificationId?: string
) => ({
  entity: "merchant",
  type: "created",
  id: `evt_merchant_created_${Date.now()}`,
  occurred_at: new Date().toISOString(),
  _embedded: {
    merchants: [
      {
        id: merchantId,
        identity: identityId,
        verification: verificationId || null,
        onboarding_state: "PROVISIONING",
        processing_enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
});

export const mockFinixWebhookVerificationUpdated = (
  verificationId: string,
  merchantIdentity: string,
  state: "SUCCEEDED" | "FAILED" | "PENDING"
) => ({
  entity: "verification",
  type: "updated",
  id: `evt_verification_updated_${Date.now()}`,
  occurred_at: new Date().toISOString(),
  _embedded: {
    verifications: [
      {
        id: verificationId,
        merchant_identity: merchantIdentity,
        state,
        created_at: new Date(Date.now() - 10000).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
});

/**
 * Helper functions to create test data in DB
 */

export async function createTestUser(
  overrides: Partial<typeof mockUserData> = {}
): Promise<IUser> {
  const userData = { ...mockUserData, ...overrides };
  return await User.create(userData);
}

export async function createTestMerchantUser(
  status: "pending" | "approved" | "rejected" = "pending",
  overrides: Partial<typeof mockMerchantUserPending> = {}
): Promise<IUser> {
  const baseData =
    status === "approved" ? mockMerchantUserApproved : mockMerchantUserPending;

  const userData = {
    ...baseData,
    ...overrides,
    ...(status === "rejected" && {
      merchant: {
        ...baseData.merchant,
        merchant_status: "REJECTED" as const,
        merchant_verification: "FAILED" as const,
      },
    }),
  };

  return await User.create(userData);
}

export async function createTestWebhookEvent(
  payload: any,
  status: "received" | "processing" | "processed" | "failed" = "received"
): Promise<IWebhookEvent> {
  const eventId = payload.id || `evt_test_${Date.now()}`;

  return await WebhookEvent.create({
    eventId,
    provider: "finix",
    type: `${payload.entity}.${payload.type}`,
    payload,
    status,
    ...(status === "processed" && { processedAt: new Date() }),
    ...(status === "failed" && { error: "Test error" }),
  });
}

export async function createTestOrder(
  overrides: Partial<IOrder> = {}
): Promise<IOrder> {
  const defaultOrder = {
    listing_id: new mongoose.Types.ObjectId(),
    listing_snapshot: {
      brand: "Rolex",
      model: "Submariner",
      reference: "116610LN",
      condition: "Excellent",
      price: 50000,
      images: ["https://example.com/image.jpg"],
      thumbnail: "https://example.com/thumb.jpg",
    },
    buyer_id: new mongoose.Types.ObjectId(),
    seller_id: new mongoose.Types.ObjectId(),
    amount: 50000,
    currency: "USD",
    status: "reserved" as const,
    finix_buyer_identity_id: "ID_buyer_test_123",
    finix_payment_instrument_id: "PI_test_123",
    finix_authorization_id: "AUTH_test_123",
    finix_transfer_id: null,
    ...overrides,
  };

  return await Order.create(defaultOrder);
}

export async function createTestMarketplaceListing(
  overrides: any = {}
): Promise<any> {
  const { MarketplaceListing } = await import("../../src/models/Listings");

  const defaultListing = {
    dialist_id: new mongoose.Types.ObjectId(),
    clerk_id: "clerk_test_123",
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
    status: "active",
    watch_snapshot: {
      brand: "Rolex",
      model: "Submariner",
      reference: "116610LN",
      diameter: "40mm",
      bezel: "Ceramic",
      materials: "Stainless Steel",
      bracelet: "Oyster",
    },
    ...overrides,
  };

  return await MarketplaceListing.create(defaultListing);
}

export async function createTestNetworkListing(
  overrides: any = {}
): Promise<any> {
  const { NetworkListing } = await import("../../src/models/Listings");

  const defaultListing = {
    dialist_id: new mongoose.Types.ObjectId(),
    clerk_id: "clerk_test_network_123",
    brand: "Omega",
    model: "Speedmaster",
    reference: "311.30.42.30.01.005",
    diameter: "42mm",
    bezel: "Aluminum",
    materials: "Steel",
    bracelet: "Steel",
    condition: "good",
    price: 5500,
    ships_from: { country: "CA" },
    watch_id: new mongoose.Types.ObjectId(),
    status: "active",
    ...overrides,
  };

  return await NetworkListing.create(defaultListing);
}

/**
 * Helper to generate mock Express request/response/next
 */
export function mockExpressContext() {
  return {
    req: {
      user: undefined as any,
      body: {},
      query: {},
      params: {},
      headers: {
        "x-request-id": `test-req-${Date.now()}`,
      },
    },
    res: {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    },
    next: jest.fn(),
  };
}

/**
 * Helper to wait for async operations (queue processing, etc.)
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to generate Basic Auth header
 */
export function generateBasicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

/**
 * Helper to generate HMAC signature (for webhook testing)
 */
export function generateWebhookSignature(
  payload: string,
  secret: string
): string {
  const crypto = require("crypto");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Cleanup helper (call in afterEach if needed)
 */
export async function cleanupDatabase() {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
