/**
 * User Routes (singular) — Current authenticated user only
 *
 * Mounted at: /api/v1/networks/user
 *
 * All routes operate on the currently authenticated user.
 * "Other user" data has moved to usersRoutes.ts (/api/v1/networks/users).
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  networks_user_get,
  networks_user_inventory_get,
  networks_user_blocks_get,
} from "../handlers/NetworksUserHandlers";
import { networks_dashboard_stats_get } from "../handlers/NetworksDashboardHandlers";
import { getUserInventorySchema } from "../../validation/schemas";
import { validateRequest } from "../../middleware/validation";
import { followService } from "../../services/follow/FollowService";
import { reviewService } from "../../services/review/ReviewService";
import { favoriteService } from "../../services";
import { recentSearchService } from "../../services";
import { isoRoutes } from "./isoRoutes";
import { feedRoutes } from "./feedRoutes";
import mongoose from "mongoose";

const router = Router();

// ──────────────────────────────────────────────────────────────────────
// Current user profile / listings / dashboard
// ──────────────────────────────────────────────────────────────────────

router.get("/", networks_user_get as any);
router.get(
  "/listings",
  validateRequest(getUserInventorySchema),
  networks_user_inventory_get as any,
);
router.get("/dashboard/stats", networks_dashboard_stats_get as any);
router.get("/blocks", networks_user_blocks_get as any);

// ──────────────────────────────────────────────────────────────────────
// Follow management (current user perspective)
// ──────────────────────────────────────────────────────────────────────

/**
 * GET /user/followers — current user's accepted followers
 */
router.get(
  "/followers",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await followService.getFollowers(userId, {
        limit,
        offset,
      });
      res.json({ ...result, limit, offset });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /user/following — users current user is following (accepted)
 */
router.get(
  "/following",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await followService.getFollowing(userId, {
        limit,
        offset,
      });
      res.json({ ...result, limit, offset });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /user/follow-requests — pending incoming follow requests (for private accounts)
 */
router.get(
  "/follow-requests",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await followService.getPendingRequests(userId, {
        limit,
        offset,
      });
      res.json({ ...result, limit, offset });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /user/following/:id — follow a user
 */
router.post(
  "/following/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const { id: targetId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      const follow = await followService.follow(userId, targetId);
      const message =
        follow.status === "pending"
          ? "Follow request sent"
          : "Successfully followed user";

      res.status(201).json({ message, follow: follow.toJSON() });
    } catch (error: any) {
      if (
        error.message === "Cannot follow yourself" ||
        error.message === "Already following this user" ||
        error.message === "Follow request already pending"
      ) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      if (error.message === "User not found") {
        res.status(404).json({ error: { message: "Target user not found" } });
        return;
      }
      next(error);
    }
  },
);

/**
 * DELETE /user/following/:id — unfollow a user (or cancel pending request)
 */
router.delete(
  "/following/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const { id: targetId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      await followService.unfollow(userId, targetId);
      res.json({ message: "Successfully unfollowed user" });
    } catch (error: any) {
      if (error.message === "Not following this user") {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  },
);

/**
 * POST /user/following/:id/accept — accept a follow request (private accounts)
 */
router.post(
  "/following/:id/accept",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const { id: followId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(followId)) {
        res
          .status(400)
          .json({ error: { message: "Invalid follow request ID" } });
        return;
      }

      const follow = await followService.acceptFollowRequest(userId, followId);
      res.json({ message: "Follow request accepted", follow: follow.toJSON() });
    } catch (error: any) {
      if (error.message === "Follow request not found") {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      if (
        error.message === "Only the target user can accept this request" ||
        error.message.startsWith("Cannot accept:")
      ) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  },
);

/**
 * POST /user/following/:id/reject — reject a follow request (private accounts)
 */
router.post(
  "/following/:id/reject",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const { id: followId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(followId)) {
        res
          .status(400)
          .json({ error: { message: "Invalid follow request ID" } });
        return;
      }

      await followService.rejectFollowRequest(userId, followId);
      res.json({ message: "Follow request rejected" });
    } catch (error: any) {
      if (error.message === "Follow request not found") {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      if (
        error.message === "Only the target user can reject this request" ||
        error.message.startsWith("Cannot reject:")
      ) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  },
);

// ──────────────────────────────────────────────────────────────────────
// Reviews (current user)
// ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/networks/user/reviews:
 *   get:
 *     summary: Get reviews received by the authenticated user (networks)
 *     tags: [Networks - User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Paginated list of reviews received.
 *   post:
 *     summary: Create a review for a completed networks order
 *     tags: [Networks - User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order_id, rating]
 *             properties:
 *               order_id:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               feedback:
 *                 type: string
 *               is_anonymous:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Review created.
 *       400:
 *         description: Already reviewed / order not completed / not a participant.
 */
router.get(
  "/reviews",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await reviewService.getReviewsForUser(userId, {
        limit,
        offset,
      });
      res.json({ data: result.reviews, total: result.total, limit, offset });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /user/reviews — create a review for a completed order
 */
router.post(
  "/reviews",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const reviewerId = (req as any).user.dialist_id;
      const { order_id, rating, feedback, is_anonymous } = req.body;

      if (!order_id || !rating || !feedback) {
        res.status(400).json({
          error: { message: "order_id, rating, and feedback are required" },
        });
        return;
      }

      const review = await reviewService.createReview({
        reviewer_id: reviewerId,
        order_id,
        rating,
        feedback,
        is_anonymous,
      });

      res
        .status(201)
        .json({ data: review.toJSON(), message: "Review created" });
    } catch (error: any) {
      if (
        error.message?.includes("not found") ||
        error.message?.includes("already reviewed") ||
        error.message?.includes("not a participant") ||
        error.message?.includes("Cannot review order")
      ) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  },
);

// ──────────────────────────────────────────────────────────────────────
// Favorites (platform = "networks" implicit)
// ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/networks/user/favorites:
 *   get:
 *     summary: Get the authenticated user's networks favorites
 *     tags: [Networks - User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by item type (e.g. "listing")
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Paginated favorites list.
 *   post:
 *     summary: Add an item to the authenticated user's networks favorites
 *     tags: [Networks - User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [item_type, item_id]
 *             properties:
 *               item_type:
 *                 type: string
 *                 example: listing
 *               item_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Favorite added.
 *       400:
 *         description: Already in favorites.
 */
/**
 * @swagger
 * /api/v1/networks/user/favorites/{type}/{id}:
 *   delete:
 *     summary: Remove an item from the authenticated user's networks favorites
 *     tags: [Networks - User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Item type (e.g. "listing")
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Item ID
 *     responses:
 *       200:
 *         description: Favorite removed.
 */
router.get(
  "/favorites",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const itemType = req.query.type as string | undefined;

      const result = await favoriteService.getFavorites(userId, {
        itemType: itemType as any,
        platform: "networks",
        limit,
        offset,
      });

      res.json({ data: result.favorites, total: result.total, limit, offset });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /user/favorites — add to networks favorites
 */
router.post(
  "/favorites",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const { item_type, item_id } = req.body;

      if (!item_type || !item_id) {
        res
          .status(400)
          .json({ error: { message: "item_type and item_id are required" } });
        return;
      }

      const favorite = await favoriteService.addFavorite({
        userId,
        itemType: item_type,
        itemId: item_id,
        platform: "networks" as any,
      });

      res.status(201).json({ data: favorite });
    } catch (error: any) {
      if (error.message?.includes("already in favorites")) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  },
);

/**
 * DELETE /user/favorites/:type/:id — remove from networks favorites
 */
router.delete(
  "/favorites/:type/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const { type, id } = req.params;

      await favoriteService.removeFavorite({
        userId,
        itemType: type as any,
        itemId: id,
        platform: "networks" as any,
      });

      res.json({ success: true, message: "Favorite removed" });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  },
);

// ──────────────────────────────────────────────────────────────────────
// Recent Searches (platform = "networks" implicit)
// ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/networks/user/searches/recent:
 *   get:
 *     summary: Get the authenticated user's recent searches (networks)
 *     tags: [Networks - User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of recent searches.
 *   post:
 *     summary: Save a recent search (networks)
 *     tags: [Networks - User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *               context:
 *                 type: string
 *               filters:
 *                 type: object
 *               result_count:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Search saved.
 *   delete:
 *     summary: Clear all recent searches (networks)
 *     tags: [Networks - User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All recent searches cleared.
 */
/**
 * @swagger
 * /api/v1/networks/user/searches/recent/{id}:
 *   delete:
 *     summary: Delete a specific recent search entry (networks)
 *     tags: [Networks - User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Search entry deleted.
 */
router.get(
  "/searches/recent",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;

      const searches = await recentSearchService.getSearches(
        userId,
        "networks" as any,
      );
      res.json({ data: searches });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /user/searches/recent — save a networks search
 */
router.post(
  "/searches/recent",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const { query, context, filters, result_count } = req.body;

      if (!query) {
        res.status(400).json({ error: { message: "query is required" } });
        return;
      }

      const search = await recentSearchService.addSearch({
        userId,
        query,
        platform: "networks" as any,
        context: context as any,
        filters,
        resultCount: result_count,
      });

      res.status(201).json({ data: search });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /user/searches/recent — clear all networks recent searches
 */
router.delete(
  "/searches/recent",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;

      await recentSearchService.clearSearches(userId, "networks" as any);
      res.json({ success: true, message: "Recent searches cleared" });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /user/searches/recent/:id — delete a specific search
 */
router.delete(
  "/searches/recent/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }
      const userId = (req as any).user.dialist_id;
      const { id } = req.params;

      await recentSearchService.deleteSearch(userId, id);
      res.json({ success: true, message: "Search entry deleted" });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  },
);

// /networks/user/isos — current user's ISOs (Intent to Sell/Offer)
router.use("/isos", isoRoutes);

// /networks/user/feeds — current user's activity feed
router.use("/feeds", feedRoutes);

export default router;
