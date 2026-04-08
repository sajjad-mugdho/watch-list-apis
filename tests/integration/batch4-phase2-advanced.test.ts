/**
 * BATCH 4 PHASE 2: Advanced Features Integration Tests
 *
 * Tests:
 * 1. Shared Content Endpoints (links, media, files)
 * 2. Group Member Management (add, remove, role updates)
 * 3. Trust & Safety / Audit Trail
 * 4. User Appeals
 */

import request from "supertest";
import mongoose, { Types } from "mongoose";
import express from "express";
import socialRoutes from "../../src/networks/routes/socialRoutes";
import orderRoutes from "../../src/networks/routes/orderRoutes";
import { usersRoutes } from "../../src/networks/routes/usersRoutes";
import { User } from "../../src/models/User";
import { SocialGroup } from "../../src/networks/models/SocialGroup";
import { SocialGroupMember } from "../../src/networks/models/SocialGroupMember";
import { Order } from "../../src/models/Order";
import { AuditLog } from "../../src/models/AuditLog";
import { ReferenceCheck } from "../../src/models/ReferenceCheck";
import { Appeal } from "../../src/models/Appeal";
import { ChatMessage } from "../../src/models/ChatMessage";

// Create Express app with routes
const app = express();
app.use(express.json());

// Add mock platform routing middleware
app.use((req: any, res, next) => {
  (req as any).platform = "networks";
  next();
});

// Mock auth middleware
app.use((req: any, res, next) => {
  const testUser = req.headers["x-test-user"] || "admin_user";
  req.auth = { userId: testUser };
  next();
});

// Mount routes
app.use("/api/v1/networks/social", socialRoutes);
app.use("/api/v1/networks/orders", orderRoutes);
app.use("/api/v1/networks/users", usersRoutes as any);

describe("Phase 2: Advanced Features", () => {
  let adminUser: any;
  let memberUser: any;
  let testGroup: any;
  let testOrder: any;
  let groupChannelId: string;

  beforeAll(async () => {
    // Create test users
    adminUser = await User.create({
      external_id: "admin_user",
      email: "admin@test.com",
      dialist_id: new Types.ObjectId(),
      clerk_id: "clerk_admin_001",
    });

    memberUser = await User.create({
      external_id: "member_user",
      email: "member@test.com",
      dialist_id: new Types.ObjectId(),
      clerk_id: "clerk_member_001",
    });

    // Create test group
    testGroup = await SocialGroup.create({
      _id: new Types.ObjectId(),
      name: "Test Group for Phase 2",
      description: "Testing shared content and member management",
      created_by: adminUser.dialist_id,
      privacy: "private",
      member_count: 2,
      getstream_channel_id: `group_${new Types.ObjectId()}`,
    });

    groupChannelId = testGroup.getstream_channel_id;

    // Add admin and member
    await SocialGroupMember.create([
      {
        group_id: testGroup._id,
        user_id: adminUser.dialist_id,
        role: "admin",
      },
      {
        group_id: testGroup._id,
        user_id: memberUser.dialist_id,
        role: "member",
      },
    ]);

    // Create test order
    testOrder = await Order.create({
      buyer_id: adminUser.dialist_id,
      seller_id: memberUser.dialist_id,
      listing_id: new Types.ObjectId(),
      status: "completed",
      amount: 100,
      listing_type: "NetworkListing",
    });

    // Create audit logs for the order
    await AuditLog.create([
      {
        order_id: testOrder._id,
        action: "ORDER_CREATED",
        actor_id: adminUser.dialist_id,
        createdAt: new Date(),
      },
      {
        order_id: testOrder._id,
        action: "ORDER_COMPLETED",
        actor_id: memberUser.dialist_id,
        previous_state: "paid",
        new_state: "completed",
        createdAt: new Date(),
      },
    ]);

    // Create test chat messages for shared content
    await ChatMessage.create([
      {
        senderId: adminUser.dialist_id,
        text: "https://example.com/article",
        stream_channel_id: groupChannelId,
        type: "link",
        attachments: [
          {
            type: "link",
            url: "https://example.com/article",
            title: "Test Article",
            description: "An interesting article",
          },
        ],
        createdAt: new Date(),
      },
      {
        senderId: memberUser.dialist_id,
        text: "Check out this image",
        stream_channel_id: groupChannelId,
        type: "image",
        attachments: [
          {
            type: "image",
            url: "https://example.com/image.jpg",
            size: 204800,
          },
        ],
        createdAt: new Date(),
      },
      {
        senderId: adminUser.dialist_id,
        text: "Important file",
        stream_channel_id: groupChannelId,
        type: "file",
        attachments: [
          {
            type: "file",
            url: "https://example.com/document.pdf",
            title: "document.pdf",
            size: 1024000,
          },
        ],
        createdAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteMany({});
    await SocialGroup.deleteMany({});
    await SocialGroupMember.deleteMany({});
    await Order.deleteMany({});
    await AuditLog.deleteMany({});
    await Appeal.deleteMany({});
    await ChatMessage.deleteMany({});
  });

  // ============================================================================
  // CATEGORY 1: SHARED CONTENT ENDPOINTS
  // ============================================================================

  describe("1. Shared Content Endpoints", () => {
    test("✅ GET /groups/:id/members - List all members", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/social/groups/${testGroup._id}/members`)
        .set("x-test-user", "admin_user")
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0]).toHaveProperty("user_id");
      expect(res.body.data[0]).toHaveProperty("role");
    });

    test("✅ GET /groups/:id/shared-links - List shared links", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/social/groups/${testGroup._id}/shared-links`)
        .set("x-test-user", "admin_user")
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body._metadata.type).toBe("links");
    });

    test("✅ POST /groups/:id/shared-links - Add a shared link", async () => {
      const res = await request(app)
        .post(`/api/v1/networks/social/groups/${testGroup._id}/shared-links`)
        .set("x-test-user", "admin_user")
        .send({
          url: "https://example.com/new-article",
          title: "New Article",
          description: "Testing shared link creation",
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.url).toBe("https://example.com/new-article");
    });

    test("✅ GET /groups/:id/shared-media - List shared media", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/social/groups/${testGroup._id}/shared-media`)
        .set("x-test-user", "admin_user")
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body._metadata.type).toBe("media");
    });

    test("✅ GET /groups/:id/shared-files - List shared files", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/social/groups/${testGroup._id}/shared-files`)
        .set("x-test-user", "admin_user")
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body._metadata.type).toBe("files");
    });
  });

  // ============================================================================
  // CATEGORY 2: GROUP MEMBER MANAGEMENT
  // ============================================================================

  describe("2. Group Member Management", () => {
    let newMemberId: string;

    beforeAll(async () => {
      const newUser = await User.create({
        external_id: `user_${Date.now()}`,
        email: `user${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_user_${Date.now()}`,
      });
      newMemberId = newUser.dialist_id.toString();
    });

    test("✅ POST /groups/:id/members - Add member to group (Admin)", async () => {
      const res = await request(app)
        .post(`/api/v1/networks/social/groups/${testGroup._id}/members`)
        .set("x-test-user", "admin_user")
        .send({ user_id: newMemberId })
        .expect(200);

      expect(res.body.data.success).toBe(true);
    });

    test("❌ POST /groups/:id/members - Reject non-admin add member attempt", async () => {
      const res = await request(app)
        .post(`/api/v1/networks/social/groups/${testGroup._id}/members`)
        .set("x-test-user", "member_user")
        .send({ user_id: new Types.ObjectId().toString() })
        .expect(403);

      expect(res.body.error).toBeDefined();
    });

    test("✅ PATCH /groups/:id/members/:userId/role - Update member role (Admin)", async () => {
      const res = await request(app)
        .patch(
          `/api/v1/networks/social/groups/${testGroup._id}/members/${newMemberId}/role`,
        )
        .set("x-test-user", "admin_user")
        .send({ role: "moderator" })
        .expect(200);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data.role).toBe("moderator");
    });

    test("⚠️ DELETE /groups/:id/members/:userId - Remove member (Admin)", async () => {
      const res = await request(app)
        .delete(
          `/api/v1/networks/social/groups/${testGroup._id}/members/${newMemberId}`,
        )
        .set("x-test-user", "admin_user")
        .expect(200);

      expect(res.body.data.success).toBe(true);
    });
  });

  // ============================================================================
  // CATEGORY 3: TRUST & SAFETY / AUDIT TRAIL
  // ============================================================================

  describe("3. Trust & Safety / Audit Trail", () => {
    test("✅ GET /orders/:id/audit-trail - Get order audit trail", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/orders/${testOrder._id}/audit-trail`)
        .set("x-test-user", "admin_user")
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      // Check audit log structure
      const log = res.body.data[0];
      expect(log).toHaveProperty("action");
      expect(log).toHaveProperty("timestamp");
      expect(log).toHaveProperty("details");
    });

    test("❌ GET /orders/:id/audit-trail - Reject unauthorized access", async () => {
      const otherUser = await User.create({
        external_id: `other_user_${Date.now()}`,
        email: `other${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_other_${Date.now()}`,
      });

      const res = await request(app)
        .get(`/api/v1/networks/orders/${testOrder._id}/audit-trail`)
        .set("x-test-user", otherUser.external_id || "other_user_test")
        .expect(403);

      expect(res.body.error).toBeDefined();
    });
  });

  // ============================================================================
  // CATEGORY 4: USER APPEALS
  // ============================================================================

  describe("4. User Appeals", () => {
    test("✅ POST /users/:id/appeals - Create an appeal", async () => {
      const res = await request(app)
        .post(`/api/v1/networks/users/${adminUser.dialist_id}/appeals`)
        .set("x-test-user", "admin_user")
        .send({
          reason: "Account suspended in error",
          description: "I did not violate any terms of service",
          appealType: "account_suspension",
          evidence: [
            {
              type: "text",
              content: "Supporting evidence text",
            },
          ],
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.appeal_id).toBeDefined();
      expect(res.body.data.status).toBe("pending");
    });

    test("⚠️ GET /users/:id/appeal-status - Get appeal status", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/users/${adminUser.dialist_id}/appeal-status`)
        .set("x-test-user", "admin_user")
        .expect(200);

      if (res.body.data) {
        expect(res.body.data).toHaveProperty("appeal_id");
        expect(res.body.data).toHaveProperty("status");
      }
    });

    test("❌ POST /users/:id/appeals - Reject appeal from different user", async () => {
      const res = await request(app)
        .post(`/api/v1/networks/users/${memberUser.dialist_id}/appeals`)
        .set("x-test-user", "admin_user")
        .send({
          reason: "Testing unauthorized appeal",
          appealType: "other",
        })
        .expect(403);

      expect(res.body.error).toBeDefined();
    });

    test("❌ GET /users/:id/appeal-status - Reject status check from different user", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/users/${memberUser.dialist_id}/appeal-status`)
        .set("x-test-user", "admin_user")
        .expect(403);

      expect(res.body.error).toBeDefined();
    });

    test("✅ GET /users/:id/appeals - List user appeals", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/users/${adminUser.dialist_id}/appeals`)
        .set("x-test-user", "admin_user")
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ============================================================================
  // CATEGORY 5: REFERENCE CHECKS (Phase 1 Carryover)
  // ============================================================================

  describe("5. Reference Checks (Phase 1 Carryover)", () => {
    test("✅ GET /reference-checks - List reference checks", async () => {
      // First create a reference check
      await ReferenceCheck.create({
        requester_id: adminUser.dialist_id,
        target_id: memberUser.dialist_id,
        order_id: testOrder._id,
        status: "completed",
      });

      const res = await request(app)
        .get("/api/v1/merchants/reference-checks")
        .set("x-test-user", "admin_user")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
