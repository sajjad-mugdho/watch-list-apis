/**
 * User Follow Routes
 *
 * Current-user follow endpoints under /api/v1/user/
 * Follow Routes for Current User (Networks-only)
 * - Follows should be under /user/ namespace
 * - Follow functionality is Networks-only (NOT Marketplace)
 * 
 * Mounted at: /api/v1/user/
 */

import { Router, Request, Response, NextFunction } from "express";
import { Follow } from "../../models/Follow";
import { User } from "../../models/User";
import { Notification } from "../../models/Notification";
import { feedService } from "../../services/FeedService";
import logger from "../../utils/logger";
import mongoose from "mongoose";

const router = Router();


/**
 * GET /api/v1/user/followers
 * Get current user's followers
 * Networks-only endpoint
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

      const follows = await Follow.find({ following_id: user._id })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("follower_id", "_id display_name avatar first_name last_name");

      const total = await Follow.countDocuments({ following_id: user._id });

      const followers = follows.map((f) => ({
        user: f.follower_id,
        followed_at: f.createdAt,
      }));

      res.json({
        data: followers,
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
 * GET /api/v1/user/following
 * Get users current user is following
 * Networks-only endpoint
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

      const follows = await Follow.find({ follower_id: user._id })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("following_id", "_id display_name avatar first_name last_name");

      const total = await Follow.countDocuments({ follower_id: user._id });

      const following = follows.map((f) => ({
        user: f.following_id,
        followed_at: f.createdAt,
      }));

      res.json({
        data: following,
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
 * POST /api/v1/user/following/:userId
 * Follow a user
 * Networks-only endpoint
 */
router.post(
  "/following/:userId",
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

      const { userId: targetId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      const followerId = followerUser._id.toString();

      if (followerId === targetId) {
        res.status(400).json({ error: { message: "Cannot follow yourself" } });
        return;
      }

      const targetUser = await User.findById(targetId);
      if (!targetUser) {
        res.status(404).json({ error: { message: "Target user not found" } });
        return;
      }

      const existingFollow = await Follow.findOne({
        follower_id: followerId,
        following_id: targetId,
      });

      if (existingFollow) {
        res.status(400).json({ error: { message: "Already following this user" } });
        return;
      }

      const follow = await Follow.create({
        follower_id: followerId,
        following_id: targetId,
      });

      try {
        await feedService.follow(followerId, targetId);
      } catch (feedError) {
        logger.warn("Failed to sync follow to Stream Feeds", { feedError });
      }

      try {
        await Notification.create({
          user_id: targetId,
          type: "new_follower",
          title: "New Follower",
          body: `${followerUser.display_name || "Someone"} started following you.`,
          data: { follower_id: followerId },
          action_url: `/users/${followerId}`,
        });
      } catch (notifError) {
        logger.warn("Failed to create follower notification", { notifError });
      }

      logger.info("User followed", { followerId, targetId });

      res.status(201).json({
        success: true,
        message: "Successfully followed user",
        data: follow.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/user/following/:userId
 * Unfollow a user
 * Networks-only endpoint
 */
router.delete(
  "/following/:userId",
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

      const { userId: targetId } = req.params;
      const followerId = followerUser._id.toString();

      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        res.status(400).json({ error: { message: "Invalid user ID" } });
        return;
      }

      const result = await Follow.findOneAndDelete({
        follower_id: followerId,
        following_id: targetId,
      });

      if (!result) {
        res.status(404).json({ error: { message: "Not following this user" } });
        return;
      }

      try {
        await feedService.unfollow(followerId, targetId);
      } catch (feedError) {
        logger.warn("Failed to sync unfollow to Stream Feeds", { feedError });
      }

      logger.info("User unfollowed", { followerId, targetId });

      res.json({
        success: true,
        message: "Successfully unfollowed user",
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as userFollowRoutes };
