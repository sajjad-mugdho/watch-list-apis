/**
 * User Route Aggregator
 * 
 * Consolidates all current-user endpoints under /api/v1/user/**
 * All "current user" endpoints under single namespace
 * 
 * The attachUser middleware is applied at router level, so all sub-routes
 * have access to req.user and req.dialistUserId without needing User.findOne().
 */

import { Router } from "express";
import { attachUser, getUser } from "../../middleware/attachUser";
import { userNotificationRoutes } from "./notifications";
import { userFavoriteRoutes } from "./favorites";
import { userSearchRoutes } from "./searches";
import { userFollowRoutes } from "./follows";
import { userIsoRoutes } from "./isos";
import { userSubscriptionRoutes } from "./subscription";
import { userTokenRoutes } from "./tokens";
import { userProfileRoutes } from "./profile";
import { userFriendshipRoutes } from "./friendship";
import { userSupportRoutes } from "./support";

const router = Router();

// Apply attachUser middleware to ALL routes in this router
// This eliminates 40+ duplicate User.findOne() calls in sub-routes
router.use(attachUser);

/**
 * @route GET /api/v1/user
 * @desc Get current authenticated user profile
 * Note: req.user is already populated by attachUser middleware
 */
router.get("/", (req, res) => {
  const user = getUser(req);
  res.json({
    data: user,
  });
});

/**
 * USER ROUTES
 */
router.use("/support", userSupportRoutes);

/**
 * /api/v1/user/notifications/*
 */
router.use("/notifications", userNotificationRoutes);

/**
 * /api/v1/user/favorites/*
 */
router.use("/favorites", userFavoriteRoutes);

/**
 * /api/v1/user/searches/*
 */
router.use("/searches", userSearchRoutes);

router.use("/", userFollowRoutes);

// Move /api/v1/isos/my → /api/v1/user/isos
router.use("/isos", userIsoRoutes);

// Move /api/v1/subscriptions/current → /api/v1/user/subscription
router.use("/subscription", userSubscriptionRoutes);

// user/tokens/feed and user/tokens/chat for GetStream tokens
router.use("/tokens", userTokenRoutes);

export { router as userSubRoutes };

