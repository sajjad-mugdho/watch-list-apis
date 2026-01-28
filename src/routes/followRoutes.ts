/**
 * Follow Routes
 *
 * Endpoints for follow/unfollow operations:
 * - Follow a user
 * - Unfollow a user
 * - Get followers
 * - Get following
 * - Check follow status
 *
 * Note: All routes are protected by requirePlatformAuth() at the router level
 */

import { Router, Request, Response, NextFunction } from "express";
import { Follow } from "../models/Follow";
import { User } from "../models/User";
import { Notification } from "../models/Notification";
import { feedService } from "../services/FeedService";
import logger from "../utils/logger";
import mongoose from "mongoose";

const router = Router();

/**
 * @swagger
 * /api/v1/users/{id}/follow:
 *   post:
 *     summary: Follow a user
 *     description: Follow another user to see their activities in your timeline
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
 *         description: Successfully followed user
 *       400:
 *         description: Cannot follow yourself or already following
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

      // Validate target user ID
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      const followerId = followerUser._id.toString();

      // Cannot follow yourself
      if (followerId === targetId) {
        res.status(400).json({ error: { message: "Cannot follow yourself" } });
        return;
      }

      // Check target user exists
      const targetUser = await User.findById(targetId);
      if (!targetUser) {
        res.status(404).json({ error: { message: "Target user not found" } });
        return;
      }

      // Check if already following
      const existingFollow = await Follow.findOne({
        follower_id: followerId,
        following_id: targetId,
      });

      if (existingFollow) {
        res.status(400).json({ error: { message: "Already following this user" } });
        return;
      }

      // Create follow relationship in database
      const follow = await Follow.create({
        follower_id: followerId,
        following_id: targetId,
      });

      // Sync with Stream Feeds
      try {
        await feedService.follow(followerId, targetId);
      } catch (feedError) {
        logger.warn("Failed to sync follow to Stream Feeds", { feedError });
        // Don't fail the request - DB is source of truth
      }

      // Notify target user
      try {
        await Notification.create({
          user_id: targetId,
          type: "new_follower",
          title: "New Follower",
          body: `${followerUser.display_name || "Someone"} started following you.`,
          data: {
            follower_id: followerId,
          },
          action_url: `/users/${followerId}`,
        });
      } catch (notifError) {
        logger.warn("Failed to create follower notification", { notifError });
      }

      logger.info("User followed", { followerId, targetId });

      res.status(201).json({
        message: "Successfully followed user",
        follow: follow.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/users/{id}/follow:
 *   delete:
 *     summary: Unfollow a user
 *     description: Stop following a user
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
      const followerId = followerUser._id.toString();

      // Validate target user ID
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      // Find and delete the follow relationship
      const result = await Follow.findOneAndDelete({
        follower_id: followerId,
        following_id: targetId,
      });

      if (!result) {
        res.status(404).json({ error: { message: "Not following this user" } });
        return;
      }

      // Sync with Stream Feeds
      try {
        await feedService.unfollow(followerId, targetId);
      } catch (feedError) {
        logger.warn("Failed to sync unfollow to Stream Feeds", { feedError });
      }

      logger.info("User unfollowed", { followerId, targetId });

      res.json({
        message: "Successfully unfollowed user",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/users/{id}/followers:
 *   get:
 *     summary: Get a user's followers
 *     description: Returns list of users following the specified user
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

      // Validate user ID
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      // Check user exists
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      // Get followers with user data
      const follows = await Follow.find({ following_id: userId })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("follower_id", "_id display_name avatar first_name last_name");

      const total = await Follow.countDocuments({ following_id: userId });

      const followers = follows.map((f) => ({
        user: f.follower_id,
        followed_at: f.createdAt,
      }));

      res.json({
        followers,
        total,
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
 * /api/v1/users/{id}/following:
 *   get:
 *     summary: Get users that a user is following
 *     description: Returns list of users the specified user follows
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

      // Validate user ID
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      // Check user exists
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      // Get following with user data
      const follows = await Follow.find({ follower_id: userId })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("following_id", "_id display_name avatar first_name last_name");

      const total = await Follow.countDocuments({ follower_id: userId });

      const following = follows.map((f) => ({
        user: f.following_id,
        followed_at: f.createdAt,
      }));

      res.json({
        following,
        total,
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
 * /api/v1/users/{id}/follow/status:
 *   get:
 *     summary: Check if current user is following a user
 *     description: Returns whether the current user follows the specified user
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

      // Validate target user ID
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      const isFollowing = await Follow.isFollowing(
        currentUser._id.toString(),
        targetId
      );

      const isFollowedBy = await Follow.isFollowing(
        targetId,
        currentUser._id.toString()
      );

      res.json({
        is_following: isFollowing,
        is_followed_by: isFollowedBy,
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as followRoutes };
