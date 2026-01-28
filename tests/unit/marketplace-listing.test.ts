import request from "supertest";
import { MarketplaceListing } from "../../src/models/Listings";
import { User } from "../../src/models/User";
import { Watch } from "../../src/models/Watches";
import { MerchantOnboarding } from "../../src/models/MerchantOnboarding";

// Mock the image service to avoid S3 calls during tests
jest.mock("../../src/services/ImageService", () => ({
  imageService: {
    uploadImages: jest.fn(),
    deleteImage: jest.fn(),
    deleteImages: jest.fn(),
  },
  IMAGE_CONSTRAINTS: {
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    MAX_TOTAL_SIZE: 50 * 1024 * 1024,
    MIN_LISTING_IMAGES: 3,
    MAX_LISTING_IMAGES: 10,
  },
}));

// Import app after mocks are set up
import { app } from "../../src/app";

describe("Marketplace Listing Creation", () => {
  let authToken: string;
  let approvedMerchantId: string;
  let nonMerchantId: string;
  let watchId: string;

  beforeAll(async () => {
    // Create test watch
    const watch = await Watch.create({
      brand: "Rolex",
      model: "Submariner",
      reference: "116610LN",
      year: 2020,
      diameter: 40,
      bezel: "Cerachrom",
      materials: "904L stainless steel",
      bracelet: "Oyster",
      color: "Black",
      condition: "like-new",
    });
    watchId = watch._id.toString();

    // Create approved merchant user
    const approvedMerchant = await User.create({
      external_id: "merchant_approved", // Use mock user ID
      email: "merchant@example.com",
      first_name: "John",
      last_name: "Merchant",
      onboarding_step: 4,
      merchant: {
        onboarding_state: "APPROVED",
        verification_state: "SUCCEEDED",
        onboarded_at: new Date(),
        verified_at: new Date(),
      },
    });
    approvedMerchantId = approvedMerchant.external_id!;

    // Create non-merchant user
    const nonMerchant = await User.create({
      external_id: "buyer_us_complete", // Use mock user ID
      email: "user@example.com",
      first_name: "Jane",
      last_name: "User",
      onboarding_step: 4,
      // No merchant object = not a merchant
    });
    nonMerchantId = nonMerchant.external_id!;

    // Mock auth token (will be overridden in individual tests)
    authToken = "mock-jwt-token";
  });

  beforeEach(async () => {
    // Create MerchantOnboarding record for approved merchant
    await MerchantOnboarding.create({
      dialist_user_id: "ddd333333333333333333333", // Matches merchant_approved mock claim
      form_id: "test-form-id",
      identity_id: "test-identity-id",
      merchant_id: "test-merchant-id",
      verification_id: "test-verification-id",
      onboarding_state: "APPROVED",
      verification_state: "SUCCEEDED",
      onboarded_at: new Date(),
      verified_at: new Date(),
    });
  });

  describe("POST /api/v1/marketplace/listings", () => {
    it("should create listing successfully for approved merchant", async () => {
      const response = await request(app)
        .post("/api/v1/marketplace/listings")
        .set("x-test-user", approvedMerchantId)
        .send({
          watch: watchId,
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty("_id");
      expect(response.body.data.status).toBe("draft");
      expect(response.body.data.brand).toBe("Rolex");
      expect(response.body.data.model).toBe("Submariner");
      expect(response.body.data.reference).toBe("116610LN");
    });

    it("should return 403 for non-approved merchant", async () => {
      const response = await request(app)
        .post("/api/v1/marketplace/listings")
        .set("x-test-user", nonMerchantId)
        .send({
          watch: watchId,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain(
        "Only approved merchants can create marketplace listings"
      );
    });

    it("should return 403 for user with rejected merchant status", async () => {
      // Create user with rejected merchant status
      const rejectedMerchant = await User.create({
        external_id: "merchant_rejected",
        email: "rejected@example.com",
        first_name: "Bob",
        last_name: "Rejected",
        onboarding_step: 4,
        merchant: {
          onboarding_state: "REJECTED",
          verification_state: "FAILED",
        },
      });

      const response = await request(app)
        .post("/api/v1/marketplace/listings")
        .set("x-test-user", "merchant_rejected")
        .send({
          watch: watchId,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain(
        "Only approved merchants can create marketplace listings"
      );
    });

    it("should return 403 for user with provisioning merchant status", async () => {
      // Create user with provisioning merchant status
      const provisioningMerchant = await User.create({
        external_id: "merchant_provisioning",
        email: "provisioning@example.com",
        first_name: "Alice",
        last_name: "Provisioning",
        onboarding_step: 4,
        merchant: {
          onboarding_state: "PROVISIONING",
          verification_state: "PENDING",
        },
      });

      const response = await request(app)
        .post("/api/v1/marketplace/listings")
        .set("x-test-user", "merchant_provisioning")
        .send({
          watch: watchId,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain(
        "Only approved merchants can create marketplace listings"
      );
    });

    it("should return 401 if not authenticated", async () => {
      const response = await request(app)
        .post("/api/v1/marketplace/listings")
        .send({
          watch: watchId,
        });

      expect(response.status).toBe(401);
    });

    it("should return 404 if watch not found", async () => {
      const response = await request(app)
        .post("/api/v1/marketplace/listings")
        .set("x-test-user", approvedMerchantId)
        .send({
          watch: "507f1f77bcf86cd799439011", // Non-existent ID
        });

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain("Watch with ID");
    });
  });
});
