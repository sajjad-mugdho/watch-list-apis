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
import {
  networks_user_appeal_create,
  networks_user_appeal_status_get,
  networks_user_appeals_list,
} from "../handlers/AppealHandlers";
import { social_common_groups_get } from "../handlers/SocialHubHandlers";
import {
  getUserPublicProfileSchema,
  blockUserSchema,
  createReportSchema,
} from "../../validation/schemas";
import { validateRequest } from "../../middleware/validation";
import { User } from "../../models/User";
import { connectionService } from "../../services/connection/ConnectionService";
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
// Connection actions
// ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/networks/users/{id}/connections:
 *   post:
 *     summary: Send a connection request
 *     description: Creates a pending connection request unless an opposite pending request exists (auto-accept).
 *     tags: [Networks - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the person to connect with
 *     responses:
 *       201:
 *         description: Connection created (status = "accepted" or "pending").
 *       400:
 *         description: Cannot connect with yourself / already connected / request pending.
 *       404:
 *         description: Target user not found.
 *   delete:
 *     summary: Remove an outgoing connection/request
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
 *         description: Connection removed successfully.
 *       404:
 *         description: No outgoing connection/request found.
 */
router.post(
  "/:id/connections",
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

      const connection = await connectionService.requestConnection(
        followerUser._id.toString(),
        targetId,
      );

      const message =
        connection.status === "pending"
          ? "Connection request sent"
          : "Connection established";

      res.status(201).json({ message, connection: connection.toJSON() });
    } catch (error: any) {
      if (
        error.message === "Cannot connect with yourself" ||
        error.message === "Already connected with this user" ||
        error.message === "Connection request already pending" ||
        error.message === "Cannot connect due to block relationship"
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
  "/:id/connections",
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

      await connectionService.removeConnection(
        followerUser._id.toString(),
        targetId,
      );

      res.json({ message: "Connection removed" });
    } catch (error: any) {
      if (error.message === "No connection found for this user") {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  },
);

// ──────────────────────────────────────────────────────────────────────
// Connection read-only (other user's incoming/outgoing/status)
// ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/networks/users/{id}/connections/incoming:
 *   get:
 *     summary: Get a user's accepted incoming connections
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
 *         description: Paginated incoming connection list (accepted only).
 */
router.get(
  "/:id/connections/incoming",
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

      const result = await connectionService.getIncomingConnections(userId, {
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
  "/:id/connections/outgoing",
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

      const result = await connectionService.getOutgoingConnections(userId, {
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
  "/:id/connection-status",
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

      const status = await connectionService.getConnectionStatus(
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
    req.body = {
      ...req.body,
      target_id: req.params.id,
      target_type: req.body?.target_type || "User",
    };
    next();
  },
  validateRequest(createReportSchema),
  networks_user_report as any,
);

// ──────────────────────────────────────────────────────────────────────
// Appeals
// ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/networks/users/{id}/appeals:
 *   get:
 *     summary: List user appeals
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, under_review, approved, denied, closed]
 *     responses:
 *       200:
 *         description: List of user appeals
 *       403:
 *         description: Can only view your own appeals
 *   post:
 *     summary: Create an appeal
 *     tags: [Networks - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *               description:
 *                 type: string
 *               appealType:
 *                 type: string
 *                 enum: [account_suspension, account_restriction, transaction_dispute, other]
 *     responses:
 *       201:
 *         description: Appeal created
 *       400:
 *         description: Already has active appeal
 */
router.get("/:id/appeals", networks_user_appeals_list as any);
router.post("/:id/appeals", networks_user_appeal_create as any);

/**
 * @swagger
 * /api/v1/networks/users/{id}/appeal-status:
 *   get:
 *     summary: Get user appeal status
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
 *         description: Current appeal status
 *       403:
 *         description: Can only view your own appeal status
 */
router.get("/:id/appeal-status", networks_user_appeal_status_get as any);

export { router as usersRoutes };
