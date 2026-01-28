/**
 * User Route Aggregator
 * 
 * Consolidates all current-user endpoints under /api/v1/user/**
 * Per Michael's requirements: All "current user" endpoints under single namespace
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
import { userFriendshipRoutes } from "./friendship"; // Gap Fill Phase 4
import { userSupportRoutes } from "./support"; // Gap Fill Phase 7

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
 * /api/v1/user/profile & /api/v1/user/wishlist
 * Gap Fill Phase 1: Profile enhancement (bio, social_links, wishlist, stats)
 */
router.use("/", userProfileRoutes);

/**
 * /api/v1/user/friends/*
 * Gap Fill Phase 4: Two-way friendships
 */
router.use("/", userFriendshipRoutes);

/**
 * /api/v1/user/support/*
 * Gap Fill Phase 7: Support tickets
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

/**
 * /api/v1/user/followers & /api/v1/user/following
 * Per Michael: Move follows under /user/ namespace (Networks-only)
 */
router.use("/", userFollowRoutes);

/**
 * /api/v1/user/isos/*
 * Per Michael: Move /api/v1/isos/my → /api/v1/user/isos
 */
router.use("/isos", userIsoRoutes);

/**
 * /api/v1/user/subscription/*
 * Per Michael: Move /api/v1/subscriptions/current → /api/v1/user/subscription
 */
router.use("/subscription", userSubscriptionRoutes);

/**
 * /api/v1/user/tokens/*
 * Per Michael: user/tokens/feed and user/tokens/chat for GetStream tokens
 */
router.use("/tokens", userTokenRoutes);

export { router as userSubRoutes };

