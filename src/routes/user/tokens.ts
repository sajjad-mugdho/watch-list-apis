/**
 * User Token Routes
 * 
 * Endpoints for getting GetStream tokens for the current authenticated user.
 * Mounted at: /api/v1/user/tokens
 * 
 * Token Routes for Current User
 * - user/tokens/feed - Get Stream Feed token
 * - user/tokens/chat - Get Stream Chat token
 */

import { Router, Request, Response, NextFunction } from "express";
import { chatService } from "../../services/ChatService";
import { feedService } from "../../services/FeedService";
import { User } from "../../models/User";
import { DeviceToken } from "../../models/DeviceToken";
import logger from "../../utils/logger";
import { z } from "zod";
import { validateRequest } from "../../middleware/validation";

const router = Router();

const pushTokenSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    platform: z.enum(["ios", "android", "web"]),
    device_id: z.string().optional(),
  }),
});

const deletePushTokenSchema = z.object({
  body: z.object({
    token: z.string().min(1),
  }),
});

/**
 * GET /api/v1/user/tokens/chat
 * Get a Stream Chat token for the current user
 */
router.get(
  "/chat",
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

      // Generate Stream Chat token
      const token = await chatService.createUserToken(user._id.toString());

      logger.info("Chat token generated", { userId: user._id });

      res.json({
        data: {
          token,
          user_id: user._id.toString(),
          type: "chat",
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/user/tokens/feed
 * Get a Stream Feed token for the current user
 * Note: Feed functionality is Networks-only
 */
router.get(
  "/feed",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      // Check platform header - feeds are Networks-only
      const platform = req.headers["x-platform"] as string;
      if (platform && platform !== "networks") {
        res.status(400).json({
          error: {
            message: "Feed tokens are only available on the Networks platform",
            code: "NETWORKS_ONLY",
          },
        });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      // Generate Stream Feed token
      const token = await feedService.createUserToken(user._id.toString());

      logger.info("Feed token generated", { userId: user._id });

      res.json({
        data: {
          token,
          user_id: user._id.toString(),
          type: "feed",
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/user/tokens/push
 * Register a push notification token
 */
router.post(
  "/push",
  validateRequest(pushTokenSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { token, platform, device_id } = req.body;
      
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }
      
      // Upsert token (handles re-registration)
      await DeviceToken.findOneAndUpdate(
        { token },
        {
          user_id: user._id,
          token,
          platform,
          device_id,
          is_active: true,
          last_used_at: new Date(),
        },
        { upsert: true, new: true }
      );
      
      logger.info("Push token registered", { userId: user._id, platform });
      res.json({ success: true, message: "Push token registered" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/user/tokens/push
 * Unregister a push notification token
 */
router.delete(
  "/push",
  validateRequest(deletePushTokenSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.body;
      
      // Deactivate token
      const result = await DeviceToken.findOneAndUpdate(
        { token }, 
        { is_active: false }
      );
      
      if (!result) {
         // Even if not found, we return success for idempotency
         logger.warn("Attempted to unregister unknown token", { token: token.substring(0, 10) + "..." });
      }

      res.json({ success: true, message: "Push token unregistered" });
    } catch (error) {
      next(error);
    }
  }
);

export { router as userTokenRoutes };
