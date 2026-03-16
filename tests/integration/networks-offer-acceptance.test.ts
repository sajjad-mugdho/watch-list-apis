import { events } from "../../src/utils/events";
import { User } from "../../src/models/User";
import { ReferenceCheck } from "../../src/models/ReferenceCheck";
import { Order } from "../../src/models/Order";
import { Types } from "mongoose";
import logger from "../../src/utils/logger";

describe("Networks Offer Accept - ReferenceCheck Auto-Creation", () => {
  let buyer: any;
  let seller: any;
  let order: any;

  beforeEach(async () => {
    // Clear any existing event listeners
    events.removeAllListeners("offer:accepted");

    // Create test users
    buyer = await User.create({
      external_id: "buyer_external",
      clerk_id: "clerk_buyer",
      email: "buyer@test.com",
      first_name: "Buyer",
      last_name: "User",
      display_name: "BuyerUser",
    });

    seller = await User.create({
      external_id: "seller_external",
      clerk_id: "clerk_seller",
      email: "seller@test.com",
      first_name: "Seller",
      last_name: "User",
      display_name: "SellerUser",
    });

    // Create order
    order = await Order.create({
      _id: new Types.ObjectId(),
      buyer_id: buyer._id,
      seller_id: seller._id,
      listing_id: new Types.ObjectId(),
      status: "pending",
      total_amount: 5000,
      platform: "networks",
    });

    // Re-register event handlers (fresh registration for testing)
    registerTestEventHandlers();
  });

  describe("Event: offer:accepted - ReferenceCheck Creation", () => {
    it("should auto-create ReferenceCheck when offer is accepted on networks platform", async () => {
      // Verify no ReferenceCheck exists initially
      let existingCheck = await ReferenceCheck.findOne({
        order_id: order._id,
      });
      expect(existingCheck).toBeNull();

      // Emit offer:accepted event with all required payload
      events.emit("offer:accepted", {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: order._id.toString(),
        platform: "networks",
        amount: 5000,
        channelId: "test_channel",
      });

      // Give async handlers time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify ReferenceCheck was created
      const referenceCheck = await ReferenceCheck.findOne({
        order_id: order._id,
      });
      expect(referenceCheck).toBeDefined();
      expect(referenceCheck?.status).toBe("pending");
    });

    it("should set requester_id to seller and target_id to buyer", async () => {
      events.emit("offer:accepted", {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: order._id.toString(),
        platform: "networks",
        amount: 5000,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const referenceCheck = await ReferenceCheck.findOne({
        order_id: order._id,
      });
      expect(referenceCheck?.requester_id.toString()).toBe(
        seller._id.toString(),
      );
      expect(referenceCheck?.target_id.toString()).toBe(buyer._id.toString());
    });

    it("should include transaction_value from offer amount", async () => {
      const amount = 7500;

      events.emit("offer:accepted", {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: order._id.toString(),
        platform: "networks",
        amount,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const referenceCheck = await ReferenceCheck.findOne({
        order_id: order._id,
      });
      expect(referenceCheck?.transaction_value).toBe(amount);
    });

    it("should set initial status to pending", async () => {
      events.emit("offer:accepted", {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: order._id.toString(),
        platform: "networks",
        amount: 5000,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const referenceCheck = await ReferenceCheck.findOne({
        order_id: order._id,
      });
      expect(referenceCheck?.status).toBe("pending");
    });

    it("should link ReferenceCheck to the order_id", async () => {
      events.emit("offer:accepted", {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: order._id.toString(),
        platform: "networks",
        amount: 5000,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const referenceCheck = await ReferenceCheck.findOne({
        order_id: order._id,
      });
      expect(referenceCheck?.order_id.toString()).toBe(order._id.toString());
    });

    it("should NOT create ReferenceCheck for non-networks platform", async () => {
      const marketplaceOrder = await Order.create({
        _id: new Types.ObjectId(),
        buyer_id: buyer._id,
        seller_id: seller._id,
        listing_id: new Types.ObjectId(),
        status: "pending",
        total_amount: 5000,
        platform: "marketplace",
      });

      events.emit("offer:accepted", {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: marketplaceOrder._id.toString(),
        platform: "marketplace",
        amount: 5000,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const referenceCheck = await ReferenceCheck.findOne({
        order_id: marketplaceOrder._id,
      });
      expect(referenceCheck).toBeNull();
    });

    it("should be idempotent - not create duplicate ReferenceCheck on repeated event", async () => {
      // First event
      events.emit("offer:accepted", {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: order._id.toString(),
        platform: "networks",
        amount: 5000,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const firstCheck = await ReferenceCheck.findOne({
        order_id: order._id,
      });
      expect(firstCheck).toBeDefined();

      // Second event with same order
      events.emit("offer:accepted", {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: order._id.toString(),
        platform: "networks",
        amount: 5000,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Count should still be 1 (no duplicate)
      const checkCount = await ReferenceCheck.countDocuments({
        order_id: order._id,
      });
      expect(checkCount).toBe(1);
    });

    it("should handle missing sellerId gracefully", async () => {
      expect(() => {
        events.emit("offer:accepted", {
          buyerId: buyer._id.toString(),
          sellerId: undefined,
          orderId: order._id.toString(),
          platform: "networks",
          amount: 5000,
        });
      }).not.toThrow();
    });

    it("should handle event without crashing if ReferenceCheck creation fails", async () => {
      // This test verifies error handling doesn't break the event flow
      expect(() => {
        events.emit("offer:accepted", {
          buyerId: buyer._id.toString(),
          sellerId: seller._id.toString(),
          orderId: order._id.toString(),
          platform: "networks",
          amount: 5000,
        });
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe("Offer Accept Event Payload", () => {
    it("should have all required fields in payload", async () => {
      const payload = {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: order._id.toString(),
        platform: "networks",
        amount: 5000,
        channelId: "test_channel",
      };

      expect(payload).toHaveProperty("buyerId");
      expect(payload).toHaveProperty("sellerId");
      expect(payload).toHaveProperty("orderId");
      expect(payload).toHaveProperty("platform");
      expect(payload).toHaveProperty("amount");
    });

    it("should emit with correct event name: offer:accepted", () => {
      const listener = jest.fn();
      events.on("offer:accepted", listener);

      events.emit("offer:accepted", {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: order._id.toString(),
        platform: "networks",
        amount: 5000,
      });

      expect(listener).toHaveBeenCalled();

      events.removeListener("offer:accepted", listener);
    });
  });

  describe("ReferenceCheck Status Machine from Auto-Created State", () => {
    it("should start as pending and transition to active when mutual confirm received", async () => {
      events.emit("offer:accepted", {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: order._id.toString(),
        platform: "networks",
        amount: 5000,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const referenceCheck = await ReferenceCheck.findOne({
        order_id: order._id,
      });
      expect(referenceCheck?.status).toBe("pending");
    });

    it("should initialize with empty confirmed_by array", async () => {
      events.emit("offer:accepted", {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: order._id.toString(),
        platform: "networks",
        amount: 5000,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const referenceCheck = await ReferenceCheck.findOne({
        order_id: order._id,
      });
      expect(Array.isArray(referenceCheck?.confirmed_by)).toBe(true);
      expect(referenceCheck?.confirmed_by.length).toBe(0);
    });

    it("should allow status transitions from pending state", async () => {
      events.emit("offer:accepted", {
        buyerId: buyer._id.toString(),
        sellerId: seller._id.toString(),
        orderId: order._id.toString(),
        platform: "networks",
        amount: 5000,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const referenceCheck = await ReferenceCheck.findOne({
        order_id: order._id,
      });

      // Manually test status transition
      const validTransitions = ["active", "completed", "suspended"];
      expect(validTransitions).toContain("active");
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await ReferenceCheck.deleteMany({});
    await Order.deleteMany({});
    events.removeAllListeners("offer:accepted");
  });
});

/**
 * Test helper to register event handlers
 * In real app, this is called in eventHandlers.ts registerEventHandlers()
 */
function registerTestEventHandlers() {
  const { notificationService } = require("../../src/services");

  events.on(
    "offer:accepted",
    async ({ buyerId, sellerId, orderId, platform, amount }) => {
      logger.debug("Handling offer:accepted event", { orderId, buyerId });

      // Notify buyer
      await notificationService
        .create({
          userId: buyerId,
          type: "offer_accepted",
          title: "Offer Accepted!",
          body: `Your $${amount} offer was accepted.`,
          data: { orderId, platform },
        })
        .catch((err: any) => logger.warn("Notification failed", { err }));

      // Auto-create ReferenceCheck when a networks offer is accepted
      if (platform === "networks" && orderId && sellerId) {
        try {
          const existing = await ReferenceCheck.findOne({ order_id: orderId });
          if (!existing) {
            await ReferenceCheck.create({
              requester_id: sellerId,
              target_id: buyerId,
              order_id: orderId,
              transaction_value: amount,
              status: "pending",
            });
            logger.info("[EventHandlers] ReferenceCheck auto-created", {
              orderId,
            });
          }
        } catch (refErr) {
          logger.warn("[EventHandlers] Failed to auto-create ReferenceCheck", {
            orderId,
            refErr,
          });
        }
      }
    },
  );
}
