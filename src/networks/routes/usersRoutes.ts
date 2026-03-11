/**
 * Users Routes (plural) — Other users' public data + actions on other users
 *
 * Mounted at: /api/v1/networks/users
 *
 * All /:id routes operate on another user (not the current user).
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  networks_user_public_profile_get,
  networks_user_listings_get,
  networks_user_references_get,
  networks_user_block,
  networks_user_unblock,
  networks_user_report,
} from "../handlers/NetworksUserHandlers";
import { social_common_groups_get } from "../handlers/SocialHubHandlers";
import {
  getUserPublicProfileSchema,
  blockUserSchema,
  createReportSchema,
} from "../../validation/schemas";
import { validateRequest } from "../../middleware/validation";
import { User } from "../../models/User";
import { followService } from "../../services/follow/FollowService";
import { reviewService } from "../../services/review/ReviewService";
import { ReviewRole } from "../../models/Review";
import mongoose from "mongoose";

const router = Router();

// ──────────────────────────────────────────────────────────────────────
// Public profile / listings / references / groups
// ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/networks/users/{id}/profile:
 *   get:
 *     summary: Get another user's public networks profile
 *     tags: [Networks - Users]
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
 *         description: Public profile data (private accounts show limited info).
 *       404:
 *         description: User not found.
 */
router.get(
  "/:id/profile",
  validateRequest(getUserPublicProfileSchema),
  networks_user_public_profile_get as any,
);

/**
 * @swagger
 * /api/v1/networks/users/{id}/listings:
 *   get:
 *     summary: Get another user's active public listings
 *     description: Never returns draft listings.
 *     tags: [Networks - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Paginated list of active listings.
 */
router.get(
  "/:id/listings",
  validateRequest(getUserPublicProfileSchema),
  networks_user_listings_get as any,
);

/**
 * @swagger
 * /api/v1/networks/users/{id}/references:
 *   get:
 *     summary: Get another user's reference checks (public)
 *     tags: [Networks - Users]
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
 *         description: List of completed reference checks.
 */
router.get("/:id/references", networks_user_references_get as any);

/**
 * @swagger
 * /api/v1/networks/users/{id}/common-groups:
 *   get:
 *     summary: Get social groups shared between the current user and another user
 *     tags: [Networks - Users]
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
 *         description: List of common groups.
 */
router.get("/:id/common-groups", social_common_groups_get as any);

// ──────────────────────────────────────────────────────────────────────
// Follow actions
// ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/networks/users/{id}/follow:
 *   post:
 *     summary: Follow a user
 *     description: >
 *       If the target account is public the follow is immediately accepted.
 *       If the target account is private a pending follow request is created
 *       and the target user is notified.
 *     tags: [Networks - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the person to follow
 *     responses:
 *       201:
 *         description: Follow created (status = "accepted" or "pending").
 *       400:
 *         description: Cannot follow yourself / already following / request pending.
 *       404:
 *         description: Target user not found.
 *   delete:
 *     summary: Unfollow a user (or cancel a pending follow request)
 *     tags: [Networks - Users]
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
 *         description: Unfollowed successfully.
 *       404:
 *         description: Not following this user.
 */
router.post(
  "/:id/follow",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const followerUser = await User.findOne({ external_id: auth.userId });
      if (!followerUser) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { id: targetId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      const follow = await followService.follow(
        followerUser._id.toString(),
        targetId,
      );

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

router.delete(
  "/:id/follow",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const followerUser = await User.findOne({ external_id: auth.userId });
      if (!followerUser) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { id: targetId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      await followService.unfollow(followerUser._id.toString(), targetId);

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

// ──────────────────────────────────────────────────────────────────────
// Follow read-only (other user's followers/following/status)
// ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/networks/users/{id}/followers:
 *   get:
 *     summary: Get a user's accepted followers
 *     tags: [Networks - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Paginated follower list (accepted follows only).
 */
router.get(
  "/:id/followers",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id: userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

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

router.get(
  "/:id/following",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id: userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

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

router.get(
  "/:id/follow-status",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const currentUser = await User.findOne({ external_id: auth.userId });
      if (!currentUser) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { id: targetId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      const status = await followService.getFollowStatus(
        currentUser._id.toString(),
        targetId,
      );

      res.json(status);
    } catch (error) {
      next(error);
    }
  },
);

// ──────────────────────────────────────────────────────────────────────
// Reviews (other user's reviews)
// ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/networks/users/{id}/reviews:
 *   get:
 *     summary: Get reviews received by a user (networks platform)
 *     tags: [Networks - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [buyer, seller]
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
 *         description: Paginated list of reviews.
 */
router.get(
  "/:id/reviews",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id: userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const role = req.query.role as ReviewRole | undefined;

      const result = await reviewService.getReviewsForUser(userId, {
        ...(role ? { role } : {}),
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
 * @swagger
 * /api/v1/networks/users/{id}/review-summary:
 *   get:
 *     summary: Get rating summary for a user (total, average, star breakdown)
 *     tags: [Networks - Users]
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
 *         description: "{ total, average, breakdown: { 1-5 star counts } }"
 */
router.get(
  "/:id/review-summary",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id: userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      const summary = await reviewService.getReviewSummary(userId);

      res.json({ data: summary });
    } catch (error) {
      next(error);
    }
  },
);

// ──────────────────────────────────────────────────────────────────────
// Block / Unblock / Report
// ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/networks/users/{id}/block:
 *   post:
 *     summary: Block a user
 *     tags: [Networks - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to block
 *     responses:
 *       200:
 *         description: User blocked.
 *   delete:
 *     summary: Unblock a user
 *     tags: [Networks - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to unblock
 *     responses:
 *       200:
 *         description: User unblocked.
 */
/**
 * @swagger
 * /api/v1/networks/users/{id}/report:
 *   post:
 *     summary: Report a user
 *     tags: [Networks - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to report
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Report submitted.
 */
// POST /users/:id/block — bridge: map params.id → body.blocked_id for existing handler
router.post(
  "/:id/block",
  (req: Request, _res: Response, next: NextFunction) => {
    req.body = { ...req.body, blocked_id: req.params.id };
    next();
  },
  validateRequest(blockUserSchema),
  networks_user_block as any,
);

// DELETE /users/:id/block — reuse unblock handler (already reads from params)
router.delete(
  "/:id/block",
  (req: Request, res: Response, next: NextFunction) => {
    // Map :id → :blocked_id for the existing handler
    (req.params as any).blocked_id = req.params.id;
    (networks_user_unblock as any)(req, res, next);
  },
);

// POST /users/:id/report — bridge: map params.id → body.target_id
router.post(
  "/:id/report",
  (req: Request, _res: Response, next: NextFunction) => {
    req.body = { ...req.body, target_id: req.params.id };
    next();
  },
  validateRequest(createReportSchema),
  networks_user_report as any,
);

export { router as usersRoutes };
