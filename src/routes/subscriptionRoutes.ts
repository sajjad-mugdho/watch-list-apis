/**
 * Subscription Routes
 *
 * Endpoints for subscription management:
 * - Get current subscription
 * - Upgrade/change tier
 * - Cancel subscription
 * - Update payment method
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  Subscription,
  SUBSCRIPTION_TIER_VALUES,
  BILLING_CYCLE_VALUES,
  TIER_CONFIG,
} from "../models/Subscription";
import { User } from "../models/User";
import logger from "../utils/logger";

const router = Router();

/**
 * @swagger
 * /api/v1/subscriptions/current:
 *   get:
 *     summary: Get current user's subscription
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/current",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      let subscription = await Subscription.getByUserId(user._id.toString());

      // Create free subscription if none exists
      if (!subscription) {
        subscription = await Subscription.create({
          user_id: user._id,
          clerk_id: auth.userId,
          tier: "free",
          status: "active",
          price_cents: 0,
        });
      }

      const tierConfig = TIER_CONFIG[subscription.tier as keyof typeof TIER_CONFIG];

      res.json({
        data: {
          ...subscription.toJSON(),
          tier_info: tierConfig,
          is_active: subscription.isActive(),
          is_paid: subscription.isPaid(),
          features: subscription.getFeatures(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/subscriptions/tiers:
 *   get:
 *     summary: Get available subscription tiers
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/tiers",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const tiers = Object.entries(TIER_CONFIG).map(([key, config]) => ({
        id: key,
        name: config.name,
        price_monthly: config.price_monthly,
        price_yearly: config.price_yearly,
        features: config.features,
      }));

      res.json({
        data: tiers,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/subscriptions/upgrade:
 *   post:
 *     summary: Upgrade subscription tier
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/upgrade",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { tier, billing_cycle, payment_instrument_id } = req.body;

      if (!tier || !SUBSCRIPTION_TIER_VALUES.includes(tier)) {
        res.status(400).json({ error: { message: "Valid tier is required" } });
        return;
      }

      if (tier === "free") {
        res.status(400).json({
          error: { message: "Cannot upgrade to free tier, use downgrade instead" },
        });
        return;
      }

      const cycle = billing_cycle || "monthly";
      if (!BILLING_CYCLE_VALUES.includes(cycle)) {
        res.status(400).json({ error: { message: "Invalid billing cycle" } });
        return;
      }

      let subscription = await Subscription.getByUserId(user._id.toString());

      if (!subscription) {
        subscription = await Subscription.create({
          user_id: user._id,
          clerk_id: auth.userId,
          tier: "free",
          status: "active",
          price_cents: 0,
        });
      }

      // Check if actually upgrading
      const tierOrder = SUBSCRIPTION_TIER_VALUES;
      const currentIndex = tierOrder.indexOf(subscription.tier);
      const newIndex = tierOrder.indexOf(tier);

      if (newIndex <= currentIndex) {
        res.status(400).json({
          error: { message: "Can only upgrade to a higher tier" },
        });
        return;
      }

      const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
      const price = cycle === "yearly" ? tierConfig.price_yearly : tierConfig.price_monthly;

      // Check if payment instrument is provided for paid tiers
      if (!payment_instrument_id) {
        res.status(400).json({
          error: { message: "Payment instrument ID is required for paid subscriptions" },
        });
        return;
      }

      // ✅ INTEGRATE WITH FINIX - Process real payment
      // For subscriptions, we use a direct transfer to the platform merchant
      let transferId: string | undefined;

      // Get platform merchant ID from environment
      const platformMerchantId = process.env.FINIX_PLATFORM_MERCHANT_ID;
      
      if (platformMerchantId) {
        // Finix is configured - process real payment
        try {
          const { createTransfer } = await import("../utils/finix");
          
          logger.info("Creating Finix transfer for subscription", {
            userId: user._id,
            amount: price,
            tier,
            merchantId: platformMerchantId,
          });

          const transferResult = await createTransfer({
            amount: price,
            currency: "USD",
            source: payment_instrument_id,
            merchant_id: platformMerchantId,
            idempotency_id: `sub_${user._id}_${Date.now()}`,
            tags: {
              type: "subscription",
              user_id: user._id.toString(),
              clerk_id: auth.userId,
              tier,
              billing_cycle: cycle,
            },
          });

          if (transferResult.state === "FAILED") {
            throw new Error(
              transferResult.failure_message || "Payment transfer failed"
            );
          }

          transferId = transferResult.transfer_id;

          logger.info("Subscription payment successful", {
            userId: user._id,
            transferId,
            amount: price,
            state: transferResult.state,
          });

        } catch (paymentError: any) {
          logger.error("Subscription payment failed", {
            error: paymentError.message,
            userId: user._id,
            tier,
          });

          res.status(402).json({
            error: {
              message: "Payment processing failed",
              details: paymentError.message,
            },
          });
          return;
        }
      } else {
        // Finix not configured - log warning and proceed without payment
        // This is useful for development/testing
        logger.warn("FINIX_PLATFORM_MERCHANT_ID not configured - skipping payment", {
          userId: user._id,
          tier,
          amount: price,
        });
      }

      // Payment successful (or skipped for dev) - update subscription
      subscription.tier = tier;
      subscription.billing_cycle = cycle;
      subscription.price_cents = price;
      subscription.status = "active";
      subscription.current_period_start = new Date();

      const periodEnd = new Date();
      if (cycle === "yearly") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      subscription.current_period_end = periodEnd;

      subscription.cancel_at_period_end = false;
      (subscription as any).cancelled_at = null;

      subscription.finix_instrument_id = payment_instrument_id;
      if (transferId) {
        // Store the transfer ID in a generic metadata field
        (subscription as any).last_payment_transfer_id = transferId;
      }

      await subscription.save();

      logger.info("Subscription upgraded", {
        userId: user._id,
        newTier: tier,
        billingCycle: cycle,
      });

      res.json({
        message: "Subscription upgraded successfully",
        data: {
          ...subscription.toJSON(),
          tier_info: tierConfig,
          is_active: subscription.isActive(),
          features: subscription.getFeatures(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/subscriptions/cancel:
 *   post:
 *     summary: Cancel subscription (at period end)
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/cancel",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const subscription = await Subscription.getByUserId(user._id.toString());

      if (!subscription) {
        res.status(404).json({ error: { message: "No subscription found" } });
        return;
      }

      if (subscription.tier === "free") {
        res.status(400).json({
          error: { message: "Cannot cancel free subscription" },
        });
        return;
      }

      if (subscription.cancel_at_period_end) {
        res.status(400).json({
          error: { message: "Subscription is already set to cancel" },
        });
        return;
      }

      subscription.cancel_at_period_end = true;
      subscription.cancelled_at = new Date();
      await subscription.save();

      logger.info("Subscription cancelled", { userId: user._id });

      res.json({
        message: "Subscription will be cancelled at period end",
        data: {
          ...subscription.toJSON(),
          cancellation_effective_date: subscription.current_period_end,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/subscriptions/reactivate:
 *   post:
 *     summary: Reactivate a cancelled subscription
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/reactivate",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const subscription = await Subscription.getByUserId(user._id.toString());

      if (!subscription) {
        res.status(404).json({ error: { message: "No subscription found" } });
        return;
      }

      if (!subscription.cancel_at_period_end) {
        res.status(400).json({
          error: { message: "Subscription is not set to cancel" },
        });
        return;
      }

      if (subscription.current_period_end < new Date()) {
        res.status(400).json({
          error: { message: "Subscription has expired, please renew" },
        });
        return;
      }

      subscription.cancel_at_period_end = false;
      (subscription as any).cancelled_at = null;
      subscription.status = "active";
      await subscription.save();

      logger.info("Subscription reactivated", { userId: user._id });

      res.json({
        message: "Subscription reactivated",
        data: subscription.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/subscriptions/payment-method:
 *   put:
 *     summary: Update payment method
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/payment-method",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { payment_instrument_id } = req.body;

      if (!payment_instrument_id) {
        res.status(400).json({
          error: { message: "payment_instrument_id is required" },
        });
        return;
      }

      const subscription = await Subscription.getByUserId(user._id.toString());

      if (!subscription) {
        res.status(404).json({ error: { message: "No subscription found" } });
        return;
      }

      // TODO: Verify the payment instrument with Finix before saving

      subscription.finix_instrument_id = payment_instrument_id;
      await subscription.save();

      logger.info("Payment method updated", { userId: user._id });

      res.json({
        message: "Payment method updated successfully",
        data: subscription.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as subscriptionRoutes };
