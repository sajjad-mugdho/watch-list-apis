import request from "supertest";
import express from "express";
import { Types } from "mongoose";
import userRoutes from "../../src/networks/routes/userRoutes";
import referenceCheckRoutes from "../../src/networks/routes/referenceCheckRoutes";
import { User } from "../../src/models/User";
import { ReferenceCheck } from "../../src/models/ReferenceCheck";
import { Vouch } from "../../src/models/Vouch";
import { Order } from "../../src/models/Order";

// Setup Mock Express App
const app = express();
app.use(express.json());

// Add mock platform routing middleware
app.use((req, res, next) => {
  (req as any).platform = "networks";
  next();
});

// Mock auth middleware
app.use((req: any, res, next) => {
  req.auth = { userId: "requester_user" };
  next();
});

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/reference-checks", referenceCheckRoutes);

describe("Networks Reference Check - Pagination & References API", () => {
  let requester: any;
  let target: any;
  let referenceCheck: any;
  let order: any;

  beforeEach(async () => {
    // Create test users
    requester = await User.create({
      external_id: "requester_external",
      clerk_id: "clerk_requester",
      email: "requester@test.com",
      first_name: "Requester",
      last_name: "User",
      display_name: "RequesterUser",
    });

    target = await User.create({
      external_id: "target_external",
      clerk_id: "clerk_target",
      email: "target@test.com",
      first_name: "Target",
      last_name: "User",
      display_name: "TargetUser",
    });

    // Create test order
    order = await Order.create({
      _id: new Types.ObjectId(),
      buyer_id: requester._id,
      seller_id: target._id,
      listing_id: new Types.ObjectId(),
      status: "completed",
      amount: 5000,
      total_amount: 5000,
      platform: "networks",
      listing_type: "NetworkListing",
      listing_snapshot: {
        price: 5000,
        reference: "TEST-001",
        model: "Test Model",
        brand: "Test Brand",
      },
    });

    // Create reference check
    referenceCheck = await ReferenceCheck.create({
      _id: new Types.ObjectId(),
      requester_id: requester._id,
      target_id: target._id,
      order_id: order._id,
      transaction_value: 5000,
      status: "completed",
      confirmed_by: [requester._id, target._id],
      confirmed_at: new Date(),
    });
  });

  describe("GET /users/:id/references - Paginated Reference Check Retrieval", () => {
    let userId: string;

    beforeEach(async () => {
      userId = target._id.toString();

      // Create multiple vouches for pagination testing
      for (let i = 0; i < 35; i++) {
        const voucher = await User.create({
          external_id: `voucher_${i}_external`,
          clerk_id: `clerk_voucher_${i}`,
          email: `voucher${i}@test.com`,
          first_name: `Voucher${i}`,
          last_name: "User",
          display_name: `VoucherUser${i}`,
        });

        await Vouch.create({
          _id: new Types.ObjectId(),
          reference_check_id: referenceCheck._id,
          vouched_for_user_id: target._id,
          vouched_by_user_id: voucher._id,
          rating: i % 3 === 0 ? "positive" : "neutral",
          weight: i % 2 === 0 ? 3 : 2,
          comment: `Vouching for transaction ${i}`,
          voucher_snapshot: {
            display_name: `VoucherUser${i}`,
            connection_type: "friend",
            reputation_score: 100 - i,
          },
          legal_consent_accepted: true,
        });
      }
    });

    it("should retrieve paginated reference checks for a user with default limit (20)", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}/references`)
        .set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("_metadata");
      expect(res.body._metadata).toHaveProperty("total");
      expect(res.body._metadata).toHaveProperty("limit");
      expect(res.body._metadata).toHaveProperty("offset");
    });

    it("should respect custom limit parameter (max 50)", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}/references`)
        .query({ limit: 30 })
        .set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body._metadata.limit).toBeLessThanOrEqual(50);
    });

    it("should enforce max limit of 50", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}/references`)
        .query({ limit: 100 })
        .set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body._metadata.limit).toBeLessThanOrEqual(50);
    });

    it("should support offset pagination", async () => {
      const page1 = await request(app)
        .get(`/api/v1/users/${userId}/references`)
        .query({ limit: 10, offset: 0 });

      const page2 = await request(app)
        .get(`/api/v1/users/${userId}/references`)
        .query({ limit: 10, offset: 10 });

      expect(page1.status).toBe(200);
      expect(page2.status).toBe(200);
      expect(page1.body._metadata.offset).toBe(0);
      expect(page2.body._metadata.offset).toBe(10);
    });

    it("should filter by role when role=requester query param provided", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}/references`)
        .query({ role: "requester" });

      expect(res.status).toBe(200);
      // Should return references where userId is the requester
    });

    it("should filter by role when role=target query param provided", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}/references`)
        .query({ role: "target" });

      expect(res.status).toBe(200);
      // Should return references where userId is the target
    });

    it("should include metadata with total, limit, and offset", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}/references`)
        .query({ limit: 15, offset: 5 });

      expect(res.status).toBe(200);
      expect(res.body._metadata).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          limit: 15,
          offset: 5,
        }),
      );
    });

    it("should return 400 for invalid limit", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}/references`)
        .query({ limit: "invalid" });

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid offset", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}/references`)
        .query({ offset: "invalid" });

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent user", async () => {
      const fakeId = new Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/users/${fakeId}/references`)
        .set("Accept", "application/json");

      expect(res.status).toBe(404);
    });
  });

  describe("GET /reference-checks/:id/vouches - Paginated Vouches Retrieval", () => {
    let referenceCheckId: string;

    beforeEach(async () => {
      referenceCheckId = referenceCheck._id.toString();

      // Create multiple vouches for pagination testing
      for (let i = 0; i < 25; i++) {
        const voucher = await User.create({
          external_id: `voucher_${i}_external`,
          clerk_id: `clerk_voucher_${i}`,
          email: `voucher${i}@test.com`,
          first_name: `Voucher${i}`,
          last_name: "User",
          display_name: `VoucherUser${i}`,
        });

        await Vouch.create({
          _id: new Types.ObjectId(),
          reference_check_id: referenceCheck._id,
          vouched_for_user_id: target._id,
          vouched_by_user_id: voucher._id,
          rating:
            i % 3 === 0 ? "positive" : i % 3 === 1 ? "neutral" : "negative",
          weight: i % 2 === 0 ? 3 : 2,
          comment: `Vouching - experience ${i}`,
          voucher_snapshot: {
            display_name: `VoucherUser${i}`,
            connection_type: "friend",
            reputation_score: 100 - i,
          },
          legal_consent_accepted: true,
        });
      }
    });

    it("should retrieve paginated vouches for a reference check", async () => {
      const res = await request(app)
        .get(`/api/v1/reference-checks/${referenceCheckId}/vouches`)
        .set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("vouches");
      expect(res.body).toHaveProperty("_metadata");
    });

    it("should include total_weight in metadata", async () => {
      const res = await request(app)
        .get(`/api/v1/reference-checks/${referenceCheckId}/vouches`)
        .query({ limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body._metadata).toHaveProperty("total_weight");
      expect(typeof res.body._metadata.total_weight).toBe("number");
    });

    it("should respect limit and offset pagination", async () => {
      const res = await request(app)
        .get(`/api/v1/reference-checks/${referenceCheckId}/vouches`)
        .query({ limit: 5, offset: 0 });

      expect(res.status).toBe(200);
      expect(res.body._metadata.limit).toBe(5);
      expect(res.body._metadata.offset).toBe(0);
      expect(res.body.vouches.length).toBeLessThanOrEqual(5);
    });

    it("should return 404 for non-existent reference check", async () => {
      const fakeId = new Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/reference-checks/${fakeId}/vouches`)
        .set("Accept", "application/json");

      expect(res.status).toBe(404);
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await ReferenceCheck.deleteMany({});
    await Vouch.deleteMany({});
    await Order.deleteMany({});
  });
});
