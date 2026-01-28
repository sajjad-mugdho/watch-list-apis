/**
 * Chat Routes
 *
 * Endpoints for Stream Chat operations:
 * - Token generation for client authentication
 * - Channel creation/retrieval
 * - Unread counts
 *
 * Note: All routes are protected by requirePlatformAuth() at the router level
 */

import { Router, Request, Response, NextFunction } from "express";
import { chatService } from "../services/ChatService";
import { User } from "../models/User";
import logger from "../utils/logger";

const router = Router();


/**
 * @swagger
 * /api/v1/chat/token:
 *   get:
 *     summary: Generate Stream Chat token
 *     description: Returns a JWT token for authenticating with Stream Chat on the client
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Stream Chat JWT token
 *                 userId:
 *                   type: string
 *                   description: User ID for Stream Chat
 *       401:
 *         description: Unauthorized
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

      // Get user from database to get internal ID
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const userId = user._id.toString();
      const token = chatService.createUserToken(userId);

      // Upsert user in Stream Chat with their current info
      await chatService.upsertUser({
        id: userId,
        name:
          user.display_name ||
          `${user.first_name} ${user.last_name}`.trim() ||
          "Anonymous",
        ...(user.avatar && { avatar: user.avatar }),
      });

      logger.info("Chat token generated", { userId });

      res.json({
        token,
        userId,
        apiKey: process.env.GETSTREAM_API_KEY,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/chat/channels:
 *   get:
 *     summary: Get user's chat channels
 *     description: Returns all chat channels where the user is a member
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of channels to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: Channels retrieved successfully
 */
router.get(
  "/channels",
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

      const channels = await chatService.getUserChannels(
        user._id.toString(),
        limit,
        offset
      );

      // Transform channels to simpler format
      const channelData = channels.map((channel) => {
        const data = channel.data as any;
        return {
          id: channel.id,
          type: channel.type,
          cid: channel.cid,
          listing_id: data?.listing_id,
          listing_title: data?.listing_title,
          listing_price: data?.listing_price,
          listing_thumbnail: data?.listing_thumbnail,
          members: channel.state.members
            ? Object.keys(channel.state.members)
            : [],
          last_message_at: data?.last_message_at,
          created_at: data?.created_at,
          unread_count: channel.state.unreadCount || 0,
        };
      });

      res.json({
        channels: channelData,
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
 * /api/v1/chat/unread:
 *   get:
 *     summary: Get unread message counts
 *     description: Returns total unread count and per-channel unread counts
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread counts retrieved successfully
 */
router.get(
  "/unread",
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

      const unreadCounts = await chatService.getUnreadCounts(
        user._id.toString()
      );

      res.json(unreadCounts);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/chat/channel:
 *   post:
 *     summary: Create or get a chat channel for a listing
 *     description: Creates a new channel or returns existing one for buyer-seller conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - listing_id
 *               - seller_id
 *             properties:
 *               listing_id:
 *                 type: string
 *               seller_id:
 *                 type: string
 *               listing_title:
 *                 type: string
 *               listing_price:
 *                 type: number
 *               listing_thumbnail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Channel created/retrieved successfully
 */
router.post(
  "/channel",
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

      const {
        listing_id,
        seller_id,
        listing_title,
        listing_price,
        listing_thumbnail,
      } = req.body;

      if (!listing_id || !seller_id) {
        res.status(400).json({
          error: { message: "listing_id and seller_id are required" },
        });
        return;
      }

      // Verify seller exists
      const seller = await User.findById(seller_id);
      if (!seller) {
        res.status(404).json({ error: { message: "Seller not found" } });
        return;
      }

      // Don't allow creating channel with yourself
      if (user._id.toString() === seller_id) {
        res.status(400).json({
          error: { message: "Cannot create channel with yourself" },
        });
        return;
      }

      const { channel, channelId } = await chatService.getOrCreateChannel(
        user._id.toString(),
        seller_id,
        {
          listing_id,
          listing_title,
          listing_price,
          listing_thumbnail,
        }
      );

      res.json({
        channelId,
        channel: {
          id: channel.id,
          type: channel.type,
          cid: channel.cid,
          listing_id,
          listing_title,
          listing_price,
          listing_thumbnail,
          members: [user._id.toString(), seller_id],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as chatRoutes };
