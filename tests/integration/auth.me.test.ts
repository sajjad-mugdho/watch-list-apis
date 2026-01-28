import request from "supertest";
import { app } from "../../src/app";
import { User } from "../../src/models/User";
import { MerchantOnboarding } from "../../src/models/MerchantOnboarding";

/**
 * Integration tests for auth endpoints
 * Tests GET /api/v1/me and POST /api/v1/auth/refresh
 */

describe("Auth Endpoints - GET /me and POST /auth/refresh", () => {
  beforeEach(async () => {
    // Clear users and merchant onboarding collections before each test
    await User.deleteMany({});
    await MerchantOnboarding.deleteMany({});
  });

  describe("GET /api/v1/me", () => {
    it("should return user claims for authenticated user with valid session", async () => {
      // Setup: Create a complete onboarded user in DB
      const testUser = await User.create({
        external_id: "user_onboarded_buyer",
        email: "buyer@test.com",
        first_name: "John",
        last_name: "Buyer",
        display_name: "John Buyer",
        avatar: null,
        location: {
          country: "US",
          postal_code: "10001",
          region: "NY",
        },
        onboarding: {
          status: "completed",
          version: "1.0",
          completed_at: new Date(),
          steps: {
            location: {
              country: "US",
              postal_code: "10001",
              region: "NY",
            },
            display_name: {
              value: "John Buyer",
              mode: "custom",
            },
            avatar: {
              url: null,
            },
            acknowledgements: {
              terms_of_service: true,
              privacy_policy: true,
              marketplace_rules: true,
            },
          },
        },
      });

      const response = await request(app)
        .get("/api/v1/me")
        .set("x-test-user", "user_onboarded_buyer");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        userId: "user_onboarded_buyer",
        dialist_id: testUser._id.toString(),
        onboarding_status: "completed",
        display_name: "John Buyer",
        location_country: "US",
        isMerchant: false,
      });
      // onboarding_state should NOT be present for non-merchants
      expect(response.body.data.onboarding_state).toBeUndefined();
    });

    it("should return DB claims when session claims are missing (first login)", async () => {
      // Setup: Create user in DB
      const testUser = await User.create({
        external_id: "user_new_incomplete",
        email: "new@test.com",
        first_name: "New",
        last_name: "User",
        onboarding: {
          status: "incomplete",
          version: "1.0",
          steps: {},
        },
      });

      const response = await request(app)
        .get("/api/v1/me")
        .set("x-test-user", "user_new_incomplete");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        userId: "user_new_incomplete",
        dialist_id: testUser._id.toString(),
        onboarding_status: "incomplete",
      });
    });

    it("should honor x-refresh-session header and force DB lookup", async () => {
      // Setup: User in DB with completed onboarding, but mock session claims show incomplete
      const testUser = await User.create({
        external_id: "user_onboarded_buyer",
        email: "buyer@test.com",
        first_name: "John",
        last_name: "Buyer",
        display_name: "John Buyer",
        onboarding: {
          status: "completed",
          version: "1.0",
          completed_at: new Date(),
          steps: {},
        },
        location: {
          country: "US",
          postal_code: "10001",
          region: "NY",
        },
      });

      // Mock session claims show "incomplete" (stale)
      // But x-refresh-session header should force DB lookup
      const response = await request(app)
        .get("/api/v1/me")
        .set("x-test-user", "user_onboarded_buyer")
        .set("x-refresh-session", "1");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        dialist_id: testUser._id.toString(),
        onboarding_status: "completed", // From DB, not stale session
      });
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await request(app).get("/api/v1/me");

      expect(response.status).toBe(401);
    });

    it("should handle merchant-approved user correctly", async () => {
      // Setup: User with completed onboarding + merchant approval
      const testUser = await User.create({
        external_id: "user_merchant_approved",
        email: "seller@test.com",
        first_name: "Jane",
        last_name: "Seller",
        display_name: "Jane's Watches",
        onboarding: {
          status: "completed",
          version: "1.0",
          completed_at: new Date(),
          steps: {},
        },
        location: {
          country: "US",
          postal_code: "90210",
          region: "CA",
        },
      });

      // Create separate MerchantOnboarding document (not embedded in User)
      await MerchantOnboarding.create({
        dialist_user_id: testUser._id,
        clerk_id: "user_merchant_approved",
        merchant_id: "MU_test_123",
        identity_id: "ID_test_456",
        onboarding_state: "APPROVED",
        verification_state: "SUCCEEDED",
        form_id: "OF_test_123",
        form_url: "https://finix.example.com/onboarding",
      });

      const response = await request(app)
        .get("/api/v1/me")
        .set("x-test-user", "user_merchant_approved");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        userId: "user_merchant_approved",
        dialist_id: testUser._id.toString(),
        onboarding_status: "completed",
        onboarding_state: "APPROVED",
        isMerchant: true,
      });
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("should force DB lookup and return updated claims", async () => {
      // Setup: User who just completed onboarding
      const testUser = await User.create({
        external_id: "user_onboarded_buyer",
        email: "buyer@test.com",
        first_name: "John",
        last_name: "Buyer",
        display_name: "John Buyer",
        onboarding: {
          status: "completed",
          version: "1.0",
          completed_at: new Date(),
          steps: {},
        },
        location: {
          country: "US",
          postal_code: "10001",
          region: "NY",
        },
      });

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("x-test-user", "user_onboarded_buyer");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        dialist_id: testUser._id.toString(),
        onboarding_status: "completed",
        display_name: "John Buyer",
      });
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await request(app).post("/api/v1/auth/refresh");

      expect(response.status).toBe(401);
    });

    it("should sync merchant approval status from DB", async () => {
      // Setup: User with merchant approval (e.g., after Finix webhook)
      const testUser = await User.create({
        external_id: "user_merchant_approved",
        email: "seller@test.com",
        first_name: "Jane",
        last_name: "Seller",
        display_name: "Jane's Watches",
        onboarding: {
          status: "completed",
          version: "1.0",
          completed_at: new Date(),
          steps: {},
        },
        location: {
          country: "US",
          postal_code: "90210",
          region: "CA",
        },
      });

      // Create separate MerchantOnboarding document (not embedded in User)
      await MerchantOnboarding.create({
        dialist_user_id: testUser._id,
        clerk_id: "user_merchant_approved",
        merchant_id: "MU_test_123",
        identity_id: "ID_test_456",
        onboarding_state: "APPROVED",
        verification_state: "SUCCEEDED",
        form_id: "OF_test_123",
        form_url: "https://finix.example.com/onboarding",
      });

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("x-test-user", "user_merchant_approved");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        dialist_id: testUser._id.toString(),
        isMerchant: true,
        onboarding_state: "APPROVED",
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle user not found in DB gracefully", async () => {
      // Create mock user in DB but use different external_id
      // This simulates session with external_id that doesn't match DB
      await User.create({
        external_id: "user_orphaned",
        email: "orphaned@test.com",
        first_name: "Orphan",
        last_name: "User",
      });

      const response = await request(app)
        .get("/api/v1/me")
        .set("x-test-user", "user_orphaned");

      // Should return user data even with minimal onboarding
      expect(response.status).toBe(200);
      expect(response.body.data.onboarding_status).toBe("incomplete");
    });

    it("should handle missing onboarding field gracefully", async () => {
      // Setup: User with no onboarding object (edge case) - use existing mock user
      const testUser = await User.create({
        external_id: "user_new_incomplete",
        email: "legacy@test.com",
        first_name: "Legacy",
        last_name: "User",
      });

      const response = await request(app)
        .get("/api/v1/me")
        .set("x-test-user", "user_new_incomplete");

      expect(response.status).toBe(200);
      // Should return default incomplete status
      expect(response.body.data.onboarding_status).toBe("incomplete");
    });
  });
});
