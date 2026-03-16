/**
 * User Route Aggregator
 *
 * Consolidates all current-user endpoints under /api/v1/user/**
 * All "current user" endpoints under single namespace
 *
 * The attachUser middleware is applied at router level, so all sub-routes
 * have access to req.user and req.dialistUserId without needing User.findOne().
 *
 * NOTE: /user/favorites and /user/searches are now served by platform-scoped routes:
 *   GET/POST/DELETE /api/v1/networks/user/favorites
 *   GET/POST/DELETE /api/v1/networks/user/searches/recent
 *   GET/POST/DELETE /api/v1/networks/isos  (for ISOs)
 */

import { Router } from "express";
import { attachUser, getUser } from "../../middleware/attachUser";
import userNotificationRoutes from "./notifications";
import { userSubscriptionRoutes } from "./subscription";
import { userTokenRoutes } from "./tokens";
import { userProfileRoutes } from "./profile";
import { userSupportRoutes } from "./support";

const router = Router();

// Apply attachUser middleware to ALL routes in this router
// This eliminates 40+ duplicate User.findOne() calls in sub-routes
router.use(attachUser);

/**
 * @route GET /api/v1/user
 * @desc Get current authenticated user profile
 */
router.get("/", (req, res) => {
  const user = getUser(req);
  res.json({ data: user });
});

router.use("/support", userSupportRoutes);

// /api/v1/user/notifications/*
router.use("/notifications", userNotificationRoutes);

// /api/v1/user/subscription — current subscription tier
router.use("/subscription", userSubscriptionRoutes);

// /api/v1/user/tokens — GetStream feed + chat tokens
router.use("/tokens", userTokenRoutes);

// /api/v1/user/profile, /avatar, /wishlist, /verification, /status
router.use("/", userProfileRoutes);

export { router as userSubRoutes };
