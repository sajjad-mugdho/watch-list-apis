/**
 * Follow Routes
 *
 * Endpoints for follow/unfollow operations:
 * - Follow a user (Instagram-style: auto-accept for public, pending for private)
 * - Unfollow a user
 * - Get followers (accepted only)
 * - Get following (accepted only)
 * - Check follow status (includes pending state)
 *
 * Note: All routes are protected by requirePlatformAuth() at the router level
 */

import { Router, Request, Response, NextFunction } from "express";
import { User } from "../../models/User";
import { followService } from "../../services/follow/FollowService";
import mongoose from "mongoose";

const router = Router();

/**
 * @swagger
 * /api/v1/users/{id}/follow:
 *   post:
 *     summary: Follow a user
 *     description: Follow another user. Auto-accepted for public accounts, pending for private.
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to follow
 *     responses:
 *       201:
 *         description: Successfully followed user or request pending
 *       400:
 *         description: Cannot follow yourself, already following, or request pending
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

/**
 * @swagger
 * /api/v1/users/{id}/follow:
 *   delete:
 *     summary: Unfollow a user
 *     description: Stop following a user or cancel a pending follow request
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to unfollow
 *     responses:
 *       200:
 *         description: Successfully unfollowed user
 *       404:
 *         description: Not following this user
 */
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

/**
 * @swagger
 * /api/v1/users/{id}/followers:
 *   get:
 *     summary: Get a user's followers
 *     description: Returns list of accepted followers for the specified user
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
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
 *         description: Followers retrieved successfully
 */
router.get(
  "/:id/followers",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

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

/**
 * @swagger
 * /api/v1/users/{id}/following:
 *   get:
 *     summary: Get users that a user is following
 *     description: Returns list of accepted following for the specified user
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
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
 *         description: Following list retrieved successfully
 */
router.get(
  "/:id/following",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

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

/**
 * @swagger
 * /api/v1/users/{id}/follow/status:
 *   get:
 *     summary: Check follow status with a user
 *     description: Returns follow relationship including pending state
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to check
 *     responses:
 *       200:
 *         description: Follow status retrieved
 */
router.get(
  "/:id/follow/status",
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

export { router as followRoutes };
