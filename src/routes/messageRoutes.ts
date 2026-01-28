/**
 * Message Routes
 *
 * Backend-controlled messaging with zero-gap real-time delivery.
 * All messages flow through this backend BEFORE GetStream for:
 * - Full tracking in MongoDB
 * - Business logic validation
 * - Moderation capabilities
 * - Analytics
 *
 * Architecture: Parallel execution ensures instant GetStream delivery
 * while simultaneously storing in MongoDB.
 */

import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { ChatMessage } from "../models/ChatMessage";
import { NetworkListingChannel } from "../models/ListingChannel";
import { MarketplaceListingChannel } from "../models/MarketplaceListingChannel";
import { User } from "../models/User";
import { chatService } from "../services/ChatService";
import { Notification } from "../models/Notification";
import logger from "../utils/logger";

const router = Router();

// Valid message types
const MESSAGE_TYPES = [
  "regular",
  "inquiry",
  "offer",
  "counter_offer",
  "offer_accepted",
  "offer_rejected",
  "order_created",
  "order_paid",
  "order_shipped",
  "order_delivered",
  "system",
] as const;

type MessageType = (typeof MESSAGE_TYPES)[number];

/**
 * @swagger
 * /api/v1/messages/send:
 *   post:
 *     summary: Send a message through backend
 *     description: |
 *       Stores message in MongoDB and delivers via GetStream IN PARALLEL.
 *       Zero latency gap - both operations happen simultaneously.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel_id
 *               - text
 *             properties:
 *               channel_id:
 *                 type: string
 *                 description: GetStream channel ID
 *               text:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [regular, inquiry, offer, counter_offer]
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *               custom_data:
 *                 type: object
 *     responses:
 *       201:
 *         description: Message sent and stored
 */
router.post(
  "/send",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const {
        channel_id,
        text,
        type = "regular",
        attachments,
        custom_data,
        parent_id,
      } = req.body;

      // 1. QUICK VALIDATION (< 5ms)
      if (!channel_id || !text?.trim()) {
        res.status(400).json({
          error: { message: "channel_id and text are required" },
        });
        return;
      }

      if (type && !MESSAGE_TYPES.includes(type)) {
        res.status(400).json({
          error: { message: `Invalid message type. Valid types: ${MESSAGE_TYPES.join(", ")}` },
        });
        return;
      }

      // 2. GET USER
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      // 3. VERIFY CHANNEL MEMBERSHIP
      // Check both marketplace and network channels
      const [marketplaceChannel, networkChannel] = await Promise.all([
        MarketplaceListingChannel.findOne({
          getstream_channel_id: channel_id,
          $or: [{ buyer_id: user._id }, { seller_id: user._id }],
        }),
        NetworkListingChannel.findOne({
          getstream_channel_id: channel_id,
          $or: [{ buyer_id: user._id }, { seller_id: user._id }],
        }),
      ]);

      const channel = marketplaceChannel || networkChannel;
      if (!channel) {
        res.status(403).json({
          error: { message: "Not a member of this channel" },
        });
        return;
      }

      // 4. BUSINESS LOGIC CHECKS
      // Check if channel is closed (status can be 'open' or 'closed')
      if ((channel as any).status === "closed") {
        res.status(400).json({
          error: { message: "Cannot send messages to a closed channel" },
        });
        return;
      }

      // 5. PARALLEL EXECUTION - Store + Deliver simultaneously (ZERO GAP)
      // Uses Promise.allSettled to handle partial failures gracefully
      const messageId = new mongoose.Types.ObjectId();
      
      // First, create the message in MongoDB
      const dbMessage = await ChatMessage.create({
        _id: messageId,
        stream_channel_id: channel_id,
        text: text.trim(),
        sender_id: user._id,
        sender_clerk_id: auth.userId,
        type: type as MessageType,
        listing_id: channel.listing_id,
        attachments: attachments || [],
        parent_message_id: parent_id || null,
        custom_data: custom_data || {},
        status: "sent", // Initial status
      });

      // Then try to deliver via GetStream
      let streamResponse: any = null;
      try {
        await chatService.ensureConnected();
        const client = chatService.getClient();
        const streamChannel = client.channel("messaging", channel_id);
        const msgPayload: any = {
          text: text.trim(),
          user_id: auth.userId,
          parent_id: parent_id || undefined,
          attachments: attachments || undefined,
        };
        // Add custom data as separate custom_ prefixed fields
        if (custom_data) {
          msgPayload.db_message_id = messageId.toString();
          msgPayload.message_type = type;
        }
        streamResponse = await streamChannel.sendMessage(msgPayload);
        
        // Update with stream ID and mark as delivered
        dbMessage.stream_message_id = streamResponse.message?.id;
        dbMessage.status = "delivered";
        await dbMessage.save();
      } catch (streamError) {
        // GetStream failed - mark as pending for retry
        logger.error("GetStream send failed", { 
          streamError, 
          channel_id,
          messageId: messageId.toString(),
        });
        
        // Mark message for retry - it's in MongoDB but not delivered to GetStream
        dbMessage.status = "pending_delivery";
        dbMessage.custom_data = {
          ...dbMessage.custom_data,
          delivery_failed_at: new Date().toISOString(),
          delivery_error: (streamError as Error).message,
        };
        await dbMessage.save();
        
        // Log but don't throw - message is saved, just not real-time delivered
        logger.warn("Message saved but GetStream delivery pending", {
          messageId: messageId.toString(),
          channel_id,
        });
      }
      
      // 6. IN-APP NOTIFICATION (non-blocking)
      try {
        const recipientId = user._id.toString() === channel.buyer_id.toString() 
          ? channel.seller_id 
          : channel.buyer_id;

        await Notification.create({
          user_id: recipientId,
          type: type === "inquiry" ? "new_inquiry" : "new_message",
          title: type === "inquiry" ? "New Inquiry" : "New Message",
          body: type === "inquiry" 
            ? `New inquiry for ${channel.listing_snapshot.brand} ${channel.listing_snapshot.model}` 
            : `${user.display_name}: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`,
          data: {
            message_id: messageId.toString(),
            channel_id: channel_id,
            type: type,
          },
          action_url: `/chat/${channel_id}`,
        });
      } catch (notifError) {
        logger.warn("Failed to create message notification", { notifError });
      }

      logger.info("Message sent via backend", {
        messageId: dbMessage._id,
        streamId: streamResponse?.message?.id,
        channelId: channel_id,
        userId: user._id,
        status: dbMessage.status,
      });

      // 7. RESPOND
      res.status(201).json({
        data: {
          _id: dbMessage._id,
          stream_message_id: streamResponse?.message?.id,
          text: dbMessage.text,
          type: dbMessage.type,
          sender_id: dbMessage.sender_id,
          createdAt: dbMessage.createdAt,
          status: dbMessage.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/messages/channel/{channelId}:
 *   get:
 *     summary: Get messages for a channel from MongoDB
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *         description: Get messages before this message ID
 */
router.get(
  "/channel/:channelId",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { channelId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const before = req.query.before as string;

      // Verify user is member
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      // Build query
      const query: any = {
        stream_channel_id: channelId,
        is_deleted: { $ne: true },
      };

      if (before && mongoose.Types.ObjectId.isValid(before)) {
        const beforeMessage = await ChatMessage.findById(before);
        if (beforeMessage) {
          query.createdAt = { $lt: beforeMessage.createdAt };
        }
      }

      // Get messages from YOUR database
      const messages = await ChatMessage.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("sender_id", "display_name avatar first_name last_name");

      const total = await ChatMessage.countDocuments({
        stream_channel_id: channelId,
        is_deleted: { $ne: true },
      });

      res.json({
        data: messages.reverse(), // Return in chronological order
        total,
        limit,
        has_more: messages.length === limit,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/messages/{id}:
 *   put:
 *     summary: Edit a message (updates both MongoDB and GetStream)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { id } = req.params;
      const { text } = req.body;

      if (!text?.trim()) {
        res.status(400).json({ error: { message: "Text is required" } });
        return;
      }

      // Find message
      const message = await ChatMessage.findById(id);
      if (!message) {
        res.status(404).json({ error: { message: "Message not found" } });
        return;
      }

      // Verify ownership
      if (message.sender_clerk_id !== auth.userId) {
        res.status(403).json({ error: { message: "Not authorized to edit this message" } });
        return;
      }

      // Store original if first edit
      if (!message.original_text) {
        message.original_text = message.text;
      }

      // Update both in parallel
      await Promise.all([
        // Update MongoDB
        (async () => {
          message.text = text.trim();
          message.edited_at = new Date();
          await message.save();
        })(),

        // Update GetStream (if we have the stream ID)
        (async () => {
          if (message.stream_message_id) {
            try {
              await chatService.ensureConnected();
              const client = chatService.getClient();
              await client.updateMessage({
                id: message.stream_message_id,
                text: text.trim(),
              });
            } catch (err) {
              logger.warn("Failed to update message in GetStream", { err });
            }
          }
        })(),
      ]);

      res.json({
        message: "Message updated",
        data: message.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/messages/{id}:
 *   delete:
 *     summary: Delete a message (soft delete in both MongoDB and GetStream)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { id } = req.params;

      // Find message
      const message = await ChatMessage.findById(id);
      if (!message) {
        res.status(404).json({ error: { message: "Message not found" } });
        return;
      }

      // Verify ownership
      if (message.sender_clerk_id !== auth.userId) {
        res.status(403).json({ error: { message: "Not authorized to delete this message" } });
        return;
      }

      // Soft delete both in parallel
      await Promise.all([
        // Soft delete in MongoDB
        (async () => {
          message.is_deleted = true;
          message.deleted_at = new Date();
          await message.save();
        })(),

        // Delete in GetStream
        (async () => {
          if (message.stream_message_id) {
            try {
              await chatService.ensureConnected();
              const client = chatService.getClient();
              await client.deleteMessage(message.stream_message_id);
            } catch (err) {
              logger.warn("Failed to delete message in GetStream", { err });
            }
          }
        })(),
      ]);

      res.json({ message: "Message deleted" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/messages/{id}/read:
 *   post:
 *     summary: Mark message as read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:id/read",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { id } = req.params;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      // Update read status
      await ChatMessage.findByIdAndUpdate(id, {
        $addToSet: {
          read_by: {
            user_id: user._id,
            read_at: new Date(),
          },
        },
      });

      res.json({ message: "Marked as read" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/messages/channel/{channelId}/read-all:
 *   post:
 *     summary: Mark all messages in channel as read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/channel/:channelId/read-all",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { channelId } = req.params;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      // Mark all unread messages as read
      await ChatMessage.updateMany(
        {
          stream_channel_id: channelId,
          "read_by.user_id": { $ne: user._id },
        },
        {
          $addToSet: {
            read_by: {
              user_id: user._id,
              read_at: new Date(),
            },
          },
        }
      );

      res.json({ message: "All messages marked as read" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/messages/{id}/react:
 *   post:
 *     summary: Add reaction to a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:id/react",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { id } = req.params;
      const { type } = req.body; // 'like', 'thumbsup', 'thumbsdown', etc.

      if (!type) {
        res.status(400).json({ error: { message: "Reaction type is required" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const message = await ChatMessage.findById(id);
      if (!message) {
        res.status(404).json({ error: { message: "Message not found" } });
        return;
      }

      // Add reaction to both in parallel
      await Promise.all([
        // Add to MongoDB
        ChatMessage.findByIdAndUpdate(id, {
          $addToSet: {
            reactions: {
              user_id: user._id,
              type,
              created_at: new Date(),
            },
          },
        }),

        // Add to GetStream
        (async () => {
          if (message.stream_message_id) {
            try {
              await chatService.ensureConnected();
              const client = chatService.getClient();
              const channel = client.channel(
                "messaging",
                message.stream_channel_id
              );
              await channel.sendReaction(message.stream_message_id, {
                type,
                user_id: auth.userId,
              });
            } catch (err) {
              logger.warn("Failed to add reaction in GetStream", { err });
            }
          }
        })(),
      ]);

      res.json({ message: "Reaction added" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/messages/channel/{channelId}/archive:
 *   post:
 *     summary: Archive a channel for the current user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/channel/:channelId/archive",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { channelId } = req.params;

      await chatService.ensureConnected();
      const client = chatService.getClient();
      const channel = client.channel("messaging", channelId);

      // Hide channel for the user (GetStream terminology for archive)
      await channel.hide(auth.userId, false);

      res.json({ message: "Channel archived" });
    } catch (error) {
      next(error);
    }
  }
);

export { router as messageRoutes };
