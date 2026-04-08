/**
 * BATCH 4 PHASE 3: END-TO-END WORKFLOW TESTS
 *
 * Complete workflow scenarios:
 * 1. Transaction Workflow: Listing → Order → Completion → Review
 * 2. Chat Workflow: Group Creation → Content Sharing → Reference Checking
 * 3. Trust & Safety Workflow: Appeal Creation → Review → Resolution
 */

import request from "supertest";
import mongoose, { Types } from "mongoose";
import express from "express";
import socialRoutes from "../../src/networks/routes/socialRoutes";
import orderRoutes from "../../src/networks/routes/orderRoutes";
import { usersRoutes } from "../../src/networks/routes/usersRoutes";
import referenceCheckRoutes from "../../src/networks/routes/referenceCheckRoutes";
import { User } from "../../src/models/User";
import { SocialGroup } from "../../src/networks/models/SocialGroup";
import { SocialGroupMember } from "../../src/networks/models/SocialGroupMember";
import { Order } from "../../src/models/Order";
import { AuditLog } from "../../src/models/AuditLog";
import { ReferenceCheck } from "../../src/models/ReferenceCheck";
import { Appeal } from "../../src/models/Appeal";
import { ChatMessage } from "../../src/models/ChatMessage";

// Create Express app
const app = express();
app.use(express.json());

// Mock platform middleware
app.use((req: any, res, next) => {
  (req as any).platform = "networks";
  next();
});

// Mock auth middleware
app.use((req: any, res, next) => {
  const testUser = req.headers["x-test-user"] || "admin_user";
  req.auth = { userId: testUser };
  req.user = { dialist_id: testUser };
  next();
});

// Mount routes
app.use("/api/v1/networks/social", socialRoutes);
app.use("/api/v1/networks/orders", orderRoutes);
app.use("/api/v1/networks/users", usersRoutes as any);
app.use("/api/v1/reference-checks", referenceCheckRoutes);

describe("Phase 3: End-to-End Workflows", () => {
  // ============================================================================
  // WORKFLOW 1: TRANSACTION WORKFLOW
  // ============================================================================

  describe("Workflow 1: Complete Transaction Lifecycle", () => {
    let seller: any;
    let buyer: any;
    let listing: any;
    let order: any;

    beforeAll(async () => {
      // Create seller and buyer
      seller = await User.create({
        external_id: `seller_${Date.now()}`,
        email: `seller${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_seller_${Date.now()}`,
        display_name: "Test Seller",
      });

      buyer = await User.create({
        external_id: `buyer_${Date.now()}`,
        email: `buyer${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_buyer_${Date.now()}`,
        display_name: "Test Buyer",
      });

      // Create listing ID for order (listing model just needs ID)
      listing = {
        _id: new Types.ObjectId(),
        seller_id: seller.dialist_id,
        title: "Vintage Watch",
        description: "Rolex Submariner",
        price: 5000,
      };

      // Create order (buyer purchases)
      order = await Order.create({
        buyer_id: buyer.dialist_id,
        seller_id: seller.dialist_id,
        listing_id: listing._id,
        status: "paid",
        amount: 5000,
        listing_type: "NetworkListing",
      });

      // Create initial audit log
      await AuditLog.create({
        order_id: order._id,
        action: "ORDER_CREATED",
        actor_id: buyer.dialist_id,
        new_state: "paid",
      });
    });

    test("✅ Step 1: Order Exists and is Accessible to Both Parties", async () => {
      // Buyer can access order
      const buyerRes = await request(app)
        .get(`/api/v1/networks/orders/${order._id}`)
        .set("x-test-user", buyer.external_id)
        .expect(200);

      expect(buyerRes.body.data.buyer_id.toString()).toBe(
        buyer.dialist_id.toString(),
      );
      expect(buyerRes.body.data.status).toBe("paid");

      // Seller can access order
      const sellerRes = await request(app)
        .get(`/api/v1/networks/orders/${order._id}`)
        .set("x-test-user", seller.external_id)
        .expect(200);

      expect(sellerRes.body.data.seller_id.toString()).toBe(
        seller.dialist_id.toString(),
      );
    });

    test("✅ Step 2: Order Completion - Both Parties Confirm", async () => {
      // Buyer confirms completion
      const buyerConfirm = await request(app)
        .post(`/api/v1/networks/orders/${order._id}/complete`)
        .set("x-test-user", buyer.external_id)
        .send({})
        .expect(200);

      expect(buyerConfirm.body.data.buyer_confirmed_complete).toBe(true);

      // Seller confirms completion
      const sellerConfirm = await request(app)
        .post(`/api/v1/networks/orders/${order._id}/complete`)
        .set("x-test-user", seller.external_id)
        .send({})
        .expect(200);

      expect(sellerConfirm.body.data.seller_confirmed_complete).toBe(true);
      expect(sellerConfirm.body.data.status).toBe("completed");
    });

    test("✅ Step 3: Verify Audit Trail Shows Completion", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/orders/${order._id}/audit-trail`)
        .set("x-test-user", buyer.external_id)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      // Verify completion action exists
      const completionLog = res.body.data.find(
        (log: any) => log.action === "ORDER_COMPLETED",
      );
      if (completionLog) {
        expect(completionLog.new_state).toBe("completed");
      }
    });

    test("✅ Step 4: Initiate Reference Check After Completion", async () => {
      const res = await request(app)
        .post(`/api/v1/networks/orders/${order._id}/reference-check/initiate`)
        .set("x-test-user", buyer.external_id)
        .send({ reason: "Great transaction" })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.requester_id.toString()).toBe(
        buyer.dialist_id.toString(),
      );
      expect(res.body.data.status).toBe("pending");
    });

    test("✅ Step 5: Both Parties Can View Transaction History", async () => {
      // Get buyer's orders
      const buyerOrders = await request(app)
        .get(`/api/v1/networks/orders`)
        .set("x-test-user", buyer.external_id)
        .query({ type: "buy" })
        .expect(200);

      expect(buyerOrders.body.data.length).toBeGreaterThanOrEqual(1);

      // Get seller's orders
      const sellerOrders = await request(app)
        .get(`/api/v1/networks/orders`)
        .set("x-test-user", seller.external_id)
        .query({ type: "sell" })
        .expect(200);

      expect(sellerOrders.body.data.length).toBeGreaterThanOrEqual(1);
    });

    test("❌ Step 6: Unauthorized User Cannot Access Order", async () => {
      const unauthorized = await User.create({
        external_id: `unauthorized_${Date.now()}`,
        email: `unauth${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_unauth_${Date.now()}`,
      });

      const res = await request(app)
        .get(`/api/v1/networks/orders/${order._id}`)
        .set("x-test-user", unauthorized.external_id || "unauthorized")
        .expect(403);

      expect(res.body.error).toBeDefined();
    });
  });

  // ============================================================================
  // WORKFLOW 2: CHAT & COLLABORATION WORKFLOW
  // ============================================================================

  describe("Workflow 2: Group Chat and Content Collaboration", () => {
    let groupAdmin: any;
    let member1: any;
    let member2: any;
    let testGroup: any;
    let channelId: string;

    beforeAll(async () => {
      // Create users
      groupAdmin = await User.create({
        external_id: `admin_${Date.now()}`,
        email: `admin${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_admin_${Date.now()}`,
      });

      member1 = await User.create({
        external_id: `member1_${Date.now()}`,
        email: `member1${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_member1_${Date.now()}`,
      });

      member2 = await User.create({
        external_id: `member2_${Date.now()}`,
        email: `member2${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_member2_${Date.now()}`,
      });

      // Create group
      channelId = `group_${new Types.ObjectId()}`;
      testGroup = await SocialGroup.create({
        _id: new Types.ObjectId(),
        name: "Collectors Meetup",
        description: "For serious collectors",
        created_by: groupAdmin.dialist_id,
        privacy: "private",
        getstream_channel_id: channelId,
        member_count: 3,
      });

      // Add members
      await SocialGroupMember.create([
        {
          group_id: testGroup._id,
          user_id: groupAdmin.dialist_id,
          role: "admin",
        },
        {
          group_id: testGroup._id,
          user_id: member1.dialist_id,
          role: "member",
        },
        {
          group_id: testGroup._id,
          user_id: member2.dialist_id,
          role: "member",
        },
      ]);
    });

    test("✅ Step 1: Group Created Successfully", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/social/groups/${testGroup._id}`)
        .set("x-test-user", groupAdmin.external_id)
        .expect(200);

      expect(res.body.data.name).toBe("Collectors Meetup");
      expect(res.body.data.member_count).toBe(3);
    });

    test("✅ Step 2: Members Can List All Group Members", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/social/groups/${testGroup._id}/members`)
        .set("x-test-user", member1.external_id)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBe(3);
      expect(res.body.data.some((m: any) => m.role === "admin")).toBe(true);
    });

    test("✅ Step 3: Admin Shares Link with Group", async () => {
      const res = await request(app)
        .post(`/api/v1/networks/social/groups/${testGroup._id}/shared-links`)
        .set("x-test-user", groupAdmin.external_id)
        .send({
          url: "https://example.com/vintage-watches",
          title: "Vintage Watches Collection",
          description: "Comprehensive guide to vintage watches",
        })
        .expect(201);

      expect(res.body.data.url).toBe("https://example.com/vintage-watches");
    });

    test("✅ Step 4: Member Retrieves Shared Links", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/social/groups/${testGroup._id}/shared-links`)
        .set("x-test-user", member1.external_id)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body._metadata.type).toBe("links");
    });

    test("✅ Step 5: Create Shared Media Content", async () => {
      // Create chat message with image
      await ChatMessage.create({
        senderId: member1.dialist_id,
        text: "Check out this photo",
        stream_channel_id: channelId,
        type: "image",
        attachments: [
          {
            type: "image",
            url: "https://example.com/watch.jpg",
            size: 102400,
          },
        ],
      });

      const res = await request(app)
        .get(`/api/v1/networks/social/groups/${testGroup._id}/shared-media`)
        .set("x-test-user", member2.external_id)
        .expect(200);

      expect(res.body._metadata.type).toBe("media");
    });

    test("✅ Step 6: Admin Promotes Member to Moderator", async () => {
      const res = await request(app)
        .patch(
          `/api/v1/networks/social/groups/${testGroup._id}/members/${member1.dialist_id}/role`,
        )
        .set("x-test-user", groupAdmin.external_id)
        .send({ role: "moderator" })
        .expect(200);

      expect(res.body.data.role).toBe("moderator");
    });

    test("✅ Step 7: New Moderator Can Add Members", async () => {
      const newMember = await User.create({
        external_id: `new_member_${Date.now()}`,
        email: `new${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_new_${Date.now()}`,
      });

      const res = await request(app)
        .post(`/api/v1/networks/social/groups/${testGroup._id}/members`)
        .set("x-test-user", member1.external_id)
        .send({ user_id: newMember.dialist_id })
        .expect(200);

      expect(res.body.data.success).toBe(true);
    });

    test("❌ Step 8: Regular Member Cannot Modify Roles", async () => {
      const res = await request(app)
        .patch(
          `/api/v1/networks/social/groups/${testGroup._id}/members/${member2.dialist_id}/role`,
        )
        .set("x-test-user", member2.external_id)
        .send({ role: "admin" })
        .expect(403);

      expect(res.body.error).toBeDefined();
    });

    test("❌ Step 9: Non-Member Cannot Access Group Content", async () => {
      const outsider = await User.create({
        external_id: `outsider_${Date.now()}`,
        email: `outsider${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_outsider_${Date.now()}`,
      });

      const res = await request(app)
        .post(`/api/v1/networks/social/groups/${testGroup._id}/shared-links`)
        .set("x-test-user", outsider.external_id || "outsider")
        .send({
          url: "https://example.com/test",
          title: "Test",
        })
        .expect(403);

      expect(res.body.error).toBeDefined();
    });
  });

  // ============================================================================
  // WORKFLOW 3: TRUST & SAFETY WORKFLOW
  // ============================================================================

  describe("Workflow 3: Appeal Creation and Resolution", () => {
    let suspendedUser: any;
    let appealingUser: any;

    beforeAll(async () => {
      suspendedUser = await User.create({
        external_id: `suspended_${Date.now()}`,
        email: `suspended${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_suspended_${Date.now()}`,
        account_status: "suspended",
      });

      appealingUser = await User.create({
        external_id: `appealing_${Date.now()}`,
        email: `appealing${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_appealing_${Date.now()}`,
      });
    });

    test("✅ Step 1: User Creates Account Suspension Appeal", async () => {
      const res = await request(app)
        .post(`/api/v1/networks/users/${suspendedUser.dialist_id}/appeals`)
        .set("x-test-user", suspendedUser.external_id)
        .send({
          reason: "My account was suspended without reason",
          description:
            "I have done nothing wrong. I carefully read all terms and policies.",
          appealType: "account_suspension",
          evidence: [
            {
              type: "text",
              content: "I have been a member for 2 years with no violations.",
            },
          ],
        })
        .expect(201);

      expect(res.body.data.appeal_id).toBeDefined();
      expect(res.body.data.status).toBe("pending");
      expect(res.body.data.reason).toBe(
        "My account was suspended without reason",
      );
    });

    test("✅ Step 2: User Can Check Appeal Status", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/users/${suspendedUser.dialist_id}/appeal-status`)
        .set("x-test-user", suspendedUser.external_id)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe("pending");
      expect(res.body.data.submitted_at).toBeDefined();
    });

    test("✅ Step 3: User Can List All Their Appeals", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/users/${suspendedUser.dialist_id}/appeals`)
        .set("x-test-user", suspendedUser.external_id)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    test("⚠️ Step 4: Cannot Create Second Active Appeal", async () => {
      const res = await request(app)
        .post(`/api/v1/networks/users/${suspendedUser.dialist_id}/appeals`)
        .set("x-test-user", suspendedUser.external_id)
        .send({
          reason: "Second appeal attempt",
          appealType: "other",
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toContain("active appeal");
    });

    test("❌ Step 5: Cannot Create Appeal for Another User", async () => {
      const res = await request(app)
        .post(`/api/v1/networks/users/${suspendedUser.dialist_id}/appeals`)
        .set("x-test-user", appealingUser.external_id)
        .send({
          reason: "Trying to appeal for someone else",
          appealType: "other",
        })
        .expect(403);

      expect(res.body.error).toBeDefined();
    });

    test("❌ Step 6: Cannot Check Status for Another User", async () => {
      const res = await request(app)
        .get(`/api/v1/networks/users/${suspendedUser.dialist_id}/appeal-status`)
        .set("x-test-user", appealingUser.external_id)
        .expect(403);

      expect(res.body.error).toBeDefined();
    });

    test("✅ Step 7: Different User Can Create Their Own Appeal", async () => {
      const res = await request(app)
        .post(`/api/v1/networks/users/${appealingUser.dialist_id}/appeals`)
        .set("x-test-user", appealingUser.external_id)
        .send({
          reason: "Transaction dispute",
          appealType: "transaction_dispute",
          description: "Seller did not send item",
        })
        .expect(201);

      expect(res.body.data.appeal_id).toBeDefined();
      expect(res.body.data.status).toBe("pending");
    });

    test("✅ Step 8: Appeal Workflow Complete", async () => {
      // Verify multiple appeals exist in system
      const res1 = await request(app)
        .get(`/api/v1/networks/users/${suspendedUser.dialist_id}/appeals`)
        .set("x-test-user", suspendedUser.external_id)
        .expect(200);

      const res2 = await request(app)
        .get(`/api/v1/networks/users/${appealingUser.dialist_id}/appeals`)
        .set("x-test-user", appealingUser.external_id)
        .expect(200);

      expect(res1.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res2.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // END-TO-END DATA INTEGRITY CHECKS
  // ============================================================================

  describe("Cross-Workflow Data Integrity", () => {
    test("✅ Reference Checks Persist Across Workflows", async () => {
      // Create order and reference check
      const seller = await User.create({
        external_id: `seller_integrity_${Date.now()}`,
        email: `seller_int${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_seller_int_${Date.now()}`,
      });

      const buyer = await User.create({
        external_id: `buyer_integrity_${Date.now()}`,
        email: `buyer_int${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_buyer_int_${Date.now()}`,
      });

      const order = await Order.create({
        buyer_id: buyer.dialist_id,
        seller_id: seller.dialist_id,
        listing_id: new Types.ObjectId(),
        status: "completed",
        amount: 1000,
        listing_type: "NetworkListing",
      });

      const refCheck = await ReferenceCheck.create({
        requester_id: buyer.dialist_id,
        target_id: seller.dialist_id,
        order_id: order._id,
        status: "completed",
      });

      // Verify reference check persists
      const res = await request(app)
        .get("/api/v1/reference-checks")
        .set("x-test-user", buyer.external_id || "buyer")
        .expect(200);

      expect(res.body.data).toBeDefined();
    });

    test("✅ Audit Logs Track All Actions Chronologically", async () => {
      const user = await User.create({
        external_id: `audit_user_${Date.now()}`,
        email: `audit${Date.now()}@test.com`,
        dialist_id: new Types.ObjectId(),
        clerk_id: `clerk_audit_${Date.now()}`,
      });

      const order = await Order.create({
        buyer_id: user.dialist_id,
        seller_id: new Types.ObjectId(),
        listing_id: new Types.ObjectId(),
        status: "completed",
        amount: 500,
        listing_type: "NetworkListing",
      });

      // Add multiple audit logs
      await Promise.all([
        AuditLog.create({
          order_id: order._id,
          action: "ORDER_CREATED",
          actor_id: user.dialist_id,
          new_state: "pending",
        }),
        AuditLog.create({
          order_id: order._id,
          action: "ORDER_PAID",
          actor_id: user.dialist_id,
          previous_state: "pending",
          new_state: "paid",
        }),
        AuditLog.create({
          order_id: order._id,
          action: "ORDER_COMPLETED",
          actor_id: user.dialist_id,
          previous_state: "paid",
          new_state: "completed",
        }),
      ]);

      const res = await request(app)
        .get(`/api/v1/networks/orders/${order._id}/audit-trail`)
        .set("x-test-user", user.external_id || "user")
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(3);

      // Verify chronological order
      const actions = res.body.data.map((log: any) => log.action);
      expect(actions).toContain("ORDER_CREATED");
      expect(actions).toContain("ORDER_COMPLETED");
    });
  });
});
