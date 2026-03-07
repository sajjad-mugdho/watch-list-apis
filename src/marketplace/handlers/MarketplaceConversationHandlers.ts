import { Request, Response, NextFunction } from "express";
import { channelContextService } from "../../services/ChannelContextService";
import { User } from "../../models/User";
import logger from "../../utils/logger";

export const getConversations =
  (_platform: any) =>
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

      const parsedLimit = parseInt(req.query.limit as string);
      const limit = Math.min(
        !isNaN(parsedLimit) ? Math.max(1, parsedLimit) : 20,
        100,
      );
      const parsedOffset = parseInt(req.query.offset as string);
      const offset = !isNaN(parsedOffset) ? Math.max(0, parsedOffset) : 0;

      const conversations = await channelContextService.getConversationsForUser(
        user._id.toString(),
        _platform,
        { limit, offset },
      );

      const total =
        (conversations as any).total ??
        (conversations as any).data?.length ??
        (Array.isArray(conversations) ? conversations.length : 0) ??
        0;

      res.json({
        data: conversations,
        limit,
        offset,
        total,
      });
    } catch (error: any) {
      logger.error("[ConversationHandlers] Failed to get conversations", {
        error,
      });
      next(error);
    }
  };

export const searchConversations =
  (_platform: any) =>
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

      const q = req.query.q as string;

      if (!q || !q.trim()) {
        res.status(400).json({
          error: {
            message: "Query parameter 'q' is required and must not be empty",
          },
        });
        return;
      }

      const conversations = await channelContextService.searchConversations(
        user._id.toString(),
        q,
        _platform,
      );

      res.json({
        data: conversations,
        query: q,
        total: conversations.length,
      });
    } catch (error: any) {
      logger.error("[ConversationHandlers] Search failed", { error });
      next(error);
    }
  };

export const getConversationContext =
  (_platform: any) =>
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

      const { id } = req.params;

      const context = await channelContextService.getChannelContext(
        id,
        _platform,
      );

      if (!context) {
        res.status(404).json({ error: { message: "Conversation not found" } });
        return;
      }

      const isParty = context.parties.some((p) => p.id === user._id.toString());
      if (!isParty) {
        res.status(403).json({ error: { message: "Not authorized" } });
        return;
      }

      res.json({ data: context });
    } catch (error: any) {
      logger.error("[ConversationHandlers] Failed to get conversation", {
        error,
      });
      next(error);
    }
  };

export const getConversationMedia =
  (_platform: any) =>
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

      const { id } = req.params;
      const VALID_MEDIA_TYPES = ["image", "video", "file", "all"] as const;
      const rawType = req.query.type as string;
      const type = (
        VALID_MEDIA_TYPES.includes(rawType as any) ? rawType : "all"
      ) as "image" | "video" | "file" | "all";
      const parsedMediaLimit = parseInt(req.query.limit as string, 10);
      const limit = Math.min(
        !isNaN(parsedMediaLimit) ? Math.max(1, parsedMediaLimit) : 20,
        100,
      );
      const nextToken = req.query.next as string;

      const context = await channelContextService.getChannelContext(
        id,
        _platform,
      );

      if (!context) {
        res.status(404).json({ error: { message: "Conversation not found" } });
        return;
      }

      const isParty = context.parties.some((p) => p.id === user._id.toString());
      if (!isParty) {
        res.status(403).json({ error: { message: "Not authorized" } });
        return;
      }

      const mediaResponse = await channelContextService.getSharedMedia(
        context.getstreamChannelId,
        { type, limit, next: nextToken },
      );

      res.json(mediaResponse);
    } catch (error: any) {
      logger.error("[ConversationHandlers] Failed to get shared media", {
        error,
      });
      next(error);
    }
  };
/**
 * Conversation Routes
 *
 * API endpoints for enriched conversation/channel data.
 * These routes combine GetStream channels with MongoDB business context.
 *
 * Routes: /api/v1/conversations/*
 */

/**
 * @swagger
 * /api/v1/{platform}/conversations:
 *   get:
 *     summary: Get user's conversations with enriched context
 *     description: Returns channels enriched with listing, offer, and order data
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]
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
 *         description: Conversations retrieved successfully
 */

/**
 * @swagger
 * /api/v1/{platform}/conversations/search:
 *   get:
 *     summary: Search conversations
 *     description: Search by party name or listing details
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Search results retrieved
 */

/**
 * @swagger
 * /api/v1/{platform}/conversations/{id}:
 *   get:
 *     summary: Get full context for a specific conversation
 *     description: Returns complete channel, listing, offer, and order context
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation context retrieved
 */

/**
 * @swagger
 * /api/v1/{platform}/conversations/{id}/media:
 *   get:
 *     summary: Get shared media for a conversation
 *     description: Returns documents, images, and videos shared in the chat
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [image, video, file, all]
 *           default: all
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: next
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shared media retrieved successfully
 */
