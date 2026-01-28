/**
 * Marketplace Channel Routes
 *
 * Platform-specific channel and message handling for Marketplace.
 * Routes: /api/v1/marketplace/channels/*
 *
 * Refactored to use 3-layer architecture:
 * Routes -> Services -> Repositories
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { channelService, messageService } from "../../services";
import { validateRequest } from "../../middleware/validation";
import { User } from "../../models/User";

const router = Router();

// Validation Schemas
const getChannelsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    role: z.enum(["buyer", "seller"]).optional(),
  }),
});

const getMessagesSchema = z.object({
  params: z.object({
    channelId: z.string().min(1),
  }),
  query: z.object({
    limit: z.coerce.number().min(1).max(100).default(50),
    before: z.string().optional(),
  }),
});

const sendMessageSchema = z.object({
  params: z.object({
    channelId: z.string().min(1),
  }),
  body: z.object({
    text: z.string().min(1),
    type: z.string().optional().default("regular"),
    attachments: z.array(z.any()).optional(),
    custom_data: z.record(z.any()).optional(),
    parent_id: z.string().optional(),
  }),
});

/**
 * GET /api/v1/marketplace/channels
 * Get all marketplace channels for current user
 */
router.get(
  "/",
  validateRequest(getChannelsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { limit, offset, role } = req.query as any;

      const channels = await channelService.getChannelsForUser({
        userId: user._id.toString(),
        platform: "marketplace",
        role,
        limit,
        offset,
      });

      const total = await (channelService as any).channelRepository?.countForUser(
        user._id.toString(),
        "marketplace"
      ) || channels.length; // Fallback if count not exposed directly

      res.json({
        data: channels,
        total,
        limit,
        offset,
        platform: "marketplace",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/marketplace/channels/:channelId/messages
 * Get messages for a specific marketplace channel
 */
router.get(
  "/:channelId/messages",
  validateRequest(getMessagesSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { channelId } = req.params;
      const { limit, before } = req.query as any;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const result = await messageService.getMessages({
        channelId, // This is GetStream ID
        userId: user._id.toString(),
        platform: "marketplace",
        limit,
        before,
      });

      res.json({
        data: result.messages,
        has_more: result.hasMore,
        channel_id: channelId,
        platform: "marketplace",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/marketplace/channels/:channelId/messages
 * Send a message in a marketplace channel
 */
router.post(
  "/:channelId/messages",
  validateRequest(sendMessageSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { channelId } = req.params; // This is GetStream ID
      const { text, type, attachments, custom_data, parent_id } = req.body;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      // We need the MongoDB channel ID for sub-services, but GetStream ID is used in the URL
      const channel = await (channelService as any).getChannelByGetstreamId(
        channelId,
        user._id.toString(),
        "marketplace"
      );

      if (!channel) {
        res.status(404).json({ error: { message: "Channel not found" } });
        return;
      }

      const message = await messageService.sendMessage({
        channelId: channel._id.toString(),
        getstreamChannelId: channelId,
        userId: user._id.toString(),
        clerkId: auth.userId,
        platform: "marketplace",
        text,
        type,
        attachments,
        customData: custom_data,
        parentId: parent_id,
      });

      res.status(201).json({
        data: message,
        platform: "marketplace",
        message: "Message sent",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Not a member")) {
        res.status(403).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/marketplace/channels/:channelId/read
 * Mark messages as read in a marketplace channel
 */
router.post(
  "/:channelId/read",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { channelId } = req.params;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const count = await messageService.markAsRead(
        channelId,
        user._id.toString(),
        "marketplace"
      );

      res.json({
        success: true,
        read_count: count,
        platform: "marketplace",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/marketplace/channels/:channelId
 * Archive/Hide a marketplace channel
 */
router.delete(
  "/:channelId",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { channelId } = req.params;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      // Find MongoDB ID first
      const channel = await (channelService as any).getChannelByGetstreamId(
        channelId,
        user._id.toString(),
        "marketplace"
      );

      if (!channel) {
        res.status(404).json({ error: { message: "Channel not found" } });
        return;
      }

      await channelService.archiveChannel(
        channel._id.toString(),
        user._id.toString(),
        "marketplace"
      );

      res.json({
        success: true,
        message: "Channel archived",
        platform: "marketplace",
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as marketplaceChannelRoutes };
