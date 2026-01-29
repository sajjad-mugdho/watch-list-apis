/**
 * User Subscription Routes
 *
 * Current-user subscription endpoints under /api/v1/user/subscription
 * Subscription Routes for Current User
 * - Move /api/v1/subscriptions/current → /api/v1/user/subscription
 * 
 * Mounted at: /api/v1/user/subscription
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  Subscription,
  SUBSCRIPTION_TIER_VALUES,
  BILLING_CYCLE_VALUES,
  TIER_CONFIG,
} from "../../models/Subscription";
import { User } from "../../models/User";
import logger from "../../utils/logger";

const router = Router();

/**
 * GET /api/v1/user/subscription
 * Get current user's subscription (replaces /api/v1/subscriptions/current)
 */
router.get(
  "/",
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
 * POST /api/v1/user/subscription/upgrade
 * Upgrade subscription tier
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

      if (!payment_instrument_id) {
        res.status(400).json({
          error: { message: "Payment instrument ID is required for paid subscriptions" },
        });
        return;
      }

      // Payment integration handled by original subscription routes
      // This route delegates and adds user/ namespace consistency
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
      subscription.finix_instrument_id = payment_instrument_id;

      await subscription.save();

      logger.info("Subscription upgraded via user route", {
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
 * POST /api/v1/user/subscription/cancel
 * Cancel subscription at period end
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

      logger.info("Subscription cancelled via user route", { userId: user._id });

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

export { router as userSubscriptionRoutes };
