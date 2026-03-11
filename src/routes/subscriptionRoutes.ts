/**
 * Subscription Routes (public)
 *
 * Only public subscription info — all user-specific subscription management
 * has moved to /api/v1/user/subscription.
 */

import { Router, Request, Response, NextFunction } from "express";
import { TIER_CONFIG } from "../models/Subscription";

const router = Router();

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
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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
  },
);

export { router as subscriptionRoutes };
