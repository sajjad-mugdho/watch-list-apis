/**
 * Conversation Routes
 *
 * API endpoints for enriched conversation/channel data.
 * These routes combine GetStream channels with MongoDB business context.
 *
 * Routes: /api/v1/conversations/*
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { channelContextService, Platform } from "../services/ChannelContextService";
import { validateRequest } from "../middleware/validation";
import { User } from "../models/User";
import logger from "../utils/logger";

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================
const listConversationsSchema = z.object({
  query: z.object({
    platform: z.enum(["marketplace", "networks"]).default("marketplace"),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  }),
});

const getConversationSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  query: z.object({
    platform: z.enum(["marketplace", "networks"]).default("marketplace"),
  }),
});

const searchConversationsSchema = z.object({
  query: z.object({
    platform: z.enum(["marketplace", "networks"]).default("marketplace"),
  }),
});

const getSharedMediaSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  query: z.object({
    platform: z.enum(["marketplace", "networks"]).default("marketplace"),
    type: z.enum(["image", "video", "file", "all"]).default("all"),
    limit: z.coerce.number().min(1).max(100).default(20),
    next: z.string().optional(),
  }),
});

// ============================================================
// Routes
// ============================================================

/**
 * @swagger
 * /api/v1/conversations:
 *   get:
 *     summary: Get user's conversations with enriched context
 *     description: Returns channels enriched with listing, offer, and order data
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]
 *           default: marketplace
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
router.get(
  "/",
  validateRequest(listConversationsSchema),
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

      const { platform, limit, offset } = req.query as any;

      const conversations = await channelContextService.getConversationsForUser(
        user._id.toString(),
        platform as Platform,
        { limit, offset }
      );

      res.json({
        data: conversations,
        limit,
        offset,
        total: conversations.length,
      });
    } catch (error) {
      logger.error("[ConversationRoutes] Failed to get conversations", { error });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/conversations/search:
 *   get:
 *     summary: Search conversations
 *     description: Search by party name or listing details
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]
 *           default: marketplace
 *     responses:
 *       200:
 *         description: Search results retrieved
 */
router.get(
  "/search",
  validateRequest(searchConversationsSchema),
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

      const { q, platform } = req.query as any;

      const conversations = await channelContextService.searchConversations(
        user._id.toString(),
        q,
        platform as Platform
      );

      res.json({
        data: conversations,
        query: q,
        total: conversations.length,
      });
    } catch (error) {
      logger.error("[ConversationRoutes] Search failed", { error });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/conversations/{id}:
 *   get:
 *     summary: Get full context for a specific conversation
 *     description: Returns complete channel, listing, offer, and order context
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]
 *           default: marketplace
 *     responses:
 *       200:
 *         description: Conversation context retrieved
 */
router.get(
  "/:id",
  validateRequest(getConversationSchema),
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
      const { platform } = req.query as any;

      const context = await channelContextService.getChannelContext(
        id,
        platform as Platform
      );

      if (!context) {
        res.status(404).json({ error: { message: "Conversation not found" } });
        return;
      }

      // Verify user is a party in the conversation
      const isParty = context.parties.some(
        (p) => p.id === user._id.toString()
      );
      if (!isParty) {
        res.status(403).json({ error: { message: "Not authorized" } });
        return;
      }

      res.json({
        data: context,
      });
    } catch (error) {
      logger.error("[ConversationRoutes] Failed to get conversation", { error });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/conversations/{id}/media:
 *   get:
 *     summary: Get shared media for a conversation
 *     description: Returns documents, images, and videos shared in the chat
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]
 *           default: marketplace
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
router.get(
  "/:id/media",
  validateRequest(getSharedMediaSchema),
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
      const { platform, type, limit, next: nextToken } = req.query as any;

      // 1. Verify access and get GetStream CID
      const context = await channelContextService.getChannelContext(
        id,
        platform as Platform
      );

      if (!context) {
        res.status(404).json({ error: { message: "Conversation not found" } });
        return;
      }

      // Verify user is a party in the conversation
      const isParty = context.parties.some(
        (p) => p.id === user._id.toString()
      );
      if (!isParty) {
        res.status(403).json({ error: { message: "Not authorized" } });
        return;
      }

      // 2. Fetch media from GetStream
      const mediaResponse = await channelContextService.getSharedMedia(
        context.getstreamChannelId,
        { type, limit, next: nextToken }
      );

      res.json(mediaResponse);
    } catch (error) {
      logger.error("[ConversationRoutes] Failed to get shared media", { error });
      next(error);
    }
  }
);

export { router as conversationRoutes };
