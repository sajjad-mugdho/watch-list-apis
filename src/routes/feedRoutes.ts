/**
 * Feed Routes
 *
 * Endpoints for Stream Activity Feeds operations:
 * - Get user's timeline feed
 * - Get user's activities
 * - Feed token generation
 *
 * Note: All routes are protected by requirePlatformAuth() at the router level
 */

import { Router, Request, Response, NextFunction } from "express";
import { feedService } from "../services/FeedService";
import { User } from "../models/User";
import logger from "../utils/logger";

const router = Router();

/**
 * @swagger
 * /api/v1/feeds/token:
 *   get:
 *     summary: Generate Stream Feed token
 *     description: Returns a token for authenticating with Stream Feeds on the client
 *     tags: [Feeds]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token generated successfully
 */
router.get(
  "/token",
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

      const userId = user._id.toString();
      const token = feedService.createUserToken(userId);

      logger.info("Feed token generated", { userId });

      res.json({
        token,
        userId,
        apiKey: process.env.GETSTREAM_API_KEY,
        appId: process.env.GETSTREAM_APP_ID,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/feeds/timeline:
 *   get:
 *     summary: Get user's timeline feed
 *     description: Returns activities from users that the current user follows
 *     tags: [Feeds]
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
 *         description: Timeline retrieved successfully
 */
router.get(
  "/timeline",
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

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = parseInt(req.query.offset as string) || 0;

      const activities = await feedService.getTimeline(
        user._id.toString(),
        limit,
        offset
      );

      res.json({
        activities,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/feeds/user/{id}:
 *   get:
 *     summary: Get a user's activity feed
 *     description: Returns activities posted by a specific user
 *     tags: [Feeds]
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
 *         description: User feed retrieved successfully
 */
router.get(
  "/user/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { id: targetUserId } = req.params;

      // Verify target user exists
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = parseInt(req.query.offset as string) || 0;

      const activities = await feedService.getUserFeed(
        targetUserId,
        limit,
        offset
      );

      res.json({
        activities,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/feeds/following:
 *   get:
 *     summary: Get users that current user is following
 *     description: Returns list of users the current user follows
 *     tags: [Feeds]
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
 *         description: Following list retrieved successfully
 */
router.get(
  "/following",
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

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const following = await feedService.getFollowing(
        user._id.toString(),
        limit,
        offset
      );

      res.json({
        following,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/feeds/followers:
 *   get:
 *     summary: Get users that follow the current user
 *     description: Returns list of users following the current user
 *     tags: [Feeds]
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
 *         description: Followers list retrieved successfully
 */
router.get(
  "/followers",
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

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const followers = await feedService.getFollowers(
        user._id.toString(),
        limit,
        offset
      );

      res.json({
        followers,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as feedRoutes };
