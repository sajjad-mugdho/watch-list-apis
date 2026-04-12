import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { ChatMessage } from "../models/ChatMessage";
import { NetworkListingChannel } from "../models/NetworkListingChannel";
import { User } from "../../models/User";
import { chatService } from "../../services/ChatService";
import { networksChannelService } from "../services/NetworksChannelService";
import { networksMessageService as _networksMessageService } from "../services/NetworksMessageService";
import { channelContextService } from "../../services/ChannelContextService";
import logger from "../../utils/logger";

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
  "image",
  "file",
  "link",
] as const;

type MessageType = (typeof MESSAGE_TYPES)[number];

const getAuth = (req: Request) =>
  (req as any).auth as { userId: string } | undefined;

export const sendMessage =
  (_platform: any) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = getAuth(req);
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
        parent_message_id,
      } = req.body;

      if (
        !channel_id ||
        (!text?.trim() && (!attachments || attachments.length === 0))
      ) {
        res.status(400).json({
          error: {
            message: "channel_id and either text or attachments are required",
          },
        });
        return;
      }

      if (type && !MESSAGE_TYPES.includes(type)) {
        res.status(400).json({
          error: {
            message: `Invalid message type. Valid types: ${MESSAGE_TYPES.join(", ")}`,
          },
        });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      // We search the specific platform collection for channel membership
      const channel = await networksChannelService.getChannelByGetstreamId(
        channel_id,
        user._id.toString(),
      );

      if (!channel) {
        res
          .status(403)
          .json({ error: { message: "Not a member of this channel" } });
        return;
      }

      if (channel.status === "closed") {
        res.status(400).json({
          error: { message: "Cannot send messages to a closed channel" },
        });
        return;
      }

      const messageId = new mongoose.Types.ObjectId();

      const dbMessage = await ChatMessage.create({
        _id: messageId,
        stream_channel_id: channel_id,
        text: text?.trim() || "",
        sender_id: user._id,
        sender_clerk_id: auth.userId,
        type: type as MessageType,
        listing_id: channel.listing_id,
        attachments: attachments || [],
        parent_id: parent_id || null,
        parent_message_id: parent_message_id || null,
        custom_data: custom_data || {},
        status: "sent",
        platform: _platform || "networks",
      });

      let streamResponse: any = null;
      try {
        await chatService.ensureConnected();
        const client = chatService.getClient();
        const streamChannel = client.channel("messaging", channel_id);
        const msgPayload: any = {
          text: text?.trim() || "",
          user_id: auth.userId,
          parent_id: parent_id || undefined,
          attachments: attachments || undefined,
        };
        msgPayload.db_message_id = messageId.toString();
        msgPayload.message_type = type;

        streamResponse = await streamChannel.sendMessage(msgPayload);

        dbMessage.stream_message_id = streamResponse.message?.id;
        dbMessage.status = "delivered";
        await dbMessage.save();
      } catch (streamError) {
        logger.error("GetStream send failed", {
          streamError,
          channel_id,
          messageId: messageId.toString(),
        });
        dbMessage.status = "pending_delivery";
        dbMessage.custom_data = {
          ...dbMessage.custom_data,
          delivery_failed_at: new Date().toISOString(),
          delivery_error: (streamError as Error).message,
        };
        await dbMessage.save();
        logger.warn("Message saved but GetStream delivery pending", {
          messageId: messageId.toString(),
          channel_id,
        });
      }

      try {
        const recipientId =
          channel.buyer_id &&
          user._id.toString() === channel.buyer_id.toString()
            ? channel.seller_id
            : (channel.buyer_id ?? channel.seller_id);
        if (!recipientId) throw new Error("Channel has no valid recipient");
        // TODO: Use platform-specific notification service
        /*        await Notification.create({
          user_id: recipientId,
          type: type === "inquiry" ? "new_inquiry" : "new_message",
          title: type === "inquiry" ? "New Inquiry" : "New Message",
          body:
            type === "inquiry"
              ? `New inquiry for ${channel.listing_snapshot?.brand || "Watch"} ${channel.listing_snapshot?.model || ""}`
              : `${user.display_name}: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`,
          data: {
            message_id: messageId.toString(),
            channel_id: channel_id,
            type: type,
          },
          action_url: `/chat/${channel_id}`,
        }); */
      } catch (notifError) {
        logger.warn("Failed to create message notification", { notifError });
      }

      res.status(201).json({
        data: {
          _id: dbMessage._id,
          stream_message_id: streamResponse?.message?.id,
          text: dbMessage.text,
          type: dbMessage.type,
          sender_id: dbMessage.sender_id,
          createdAt: dbMessage.created_at,
          status: dbMessage.status,
        },
      });
    } catch (error: any) {
      next(error);
    }
  };

export const getChannelMessages =
  (_platform: any) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { channelId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const before = req.query.before as string;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      // Verify channel membership for the specific platform
      const channel = await networksChannelService.getChannelByGetstreamId(
        channelId,
        user._id.toString(),
      );

      if (!channel) {
        res.status(403).json({
          error: {
            message: "Not authorized or not a member of this channel",
          },
        });
        return;
      }

      const query: any = {
        stream_channel_id: channelId,
        is_deleted: { $ne: true },
      };

      if (before && mongoose.Types.ObjectId.isValid(before)) {
        const beforeMessage = await ChatMessage.findById(before);
        if (beforeMessage) {
          query.created_at = { $lt: beforeMessage.created_at };
        }
      }

      const [messages, total] = await Promise.all([
        ChatMessage.find(query)
          .sort({ created_at: -1 })
          .limit(limit + 1) // limit + 1 to detect has_more precisely
          .populate("sender_id", "display_name avatar first_name last_name"),
        ChatMessage.countDocuments({
          stream_channel_id: channelId,
          is_deleted: { $ne: true },
        }),
      ]);

      const has_more = messages.length > limit;
      if (has_more) messages.pop(); // Remove the extra message if present

      res.json({
        data: messages.reverse(),
        total,
        limit,
        has_more,
      });
    } catch (error: any) {
      next(error);
    }
  };

export const updateMessage =
  (_platform: "marketplace" | "networks") =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = getAuth(req);
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

      const message = await ChatMessage.findById(id);
      if (!message) {
        res.status(404).json({ error: { message: "Message not found" } });
        return;
      }

      if (message.sender_clerk_id !== auth.userId) {
        res
          .status(403)
          .json({ error: { message: "Not authorized to edit this message" } });
        return;
      }

      // Ensure message has a channel ID
      if (!message.stream_channel_id) {
        res
          .status(400)
          .json({ error: { message: "Message has no associated channel" } });
        return;
      }

      // Membership check: Ensure message belongs to a channel the user is still in
      const channelContext = await channelContextService.getChannelContext(
        message.stream_channel_id,
        _platform,
      );
      if (
        !channelContext ||
        !channelContext.parties.some(
          (p: any) => p.id === message.sender_id.toString(),
        )
      ) {
        res.status(403).json({
          error: {
            message:
              "Not authorized - you are no longer a member of this channel",
          },
        });
        return;
      }

      if (!message.original_text) {
        message.original_text = message.text;
      }

      await Promise.all([
        (async () => {
          message.text = text.trim();
          message.edited_at = new Date();
          await message.save();
        })(),
        (async () => {
          if (message.stream_message_id) {
            try {
              await chatService.ensureConnected();
              const client = chatService.getClient();
              await client.updateMessage({
                id: message.stream_message_id,
                text: text.trim(),
              });
            } catch (err: any) {
              logger.warn("Failed to update message in GetStream", { err });
            }
          }
        })(),
      ]);

      res.json({ message: "Message updated", data: message.toJSON() });
    } catch (error: any) {
      next(error);
    }
  };

export const deleteMessage =
  (_platform: "marketplace" | "networks") =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { id } = req.params;

      const message = await ChatMessage.findById(id);
      if (!message) {
        res.status(404).json({ error: { message: "Message not found" } });
        return;
      }

      if (message.sender_clerk_id !== auth.userId) {
        res.status(403).json({
          error: { message: "Not authorized to delete this message" },
        });
        return;
      }

      // Ensure message has a channel ID
      if (!message.stream_channel_id) {
        res
          .status(400)
          .json({ error: { message: "Message has no associated channel" } });
        return;
      }

      // Membership check: Ensure message belongs to a channel the user is still in
      const channelContext = await channelContextService.getChannelContext(
        message.stream_channel_id,
        _platform,
      );
      if (
        !channelContext ||
        !channelContext.parties.some(
          (p: any) => p.id === message.sender_id.toString(),
        )
      ) {
        res.status(403).json({
          error: {
            message:
              "Not authorized - you are no longer a member of this channel",
          },
        });
        return;
      }

      await Promise.all([
        (async () => {
          message.is_deleted = true;
          message.deleted_at = new Date();
          await message.save();
        })(),
        (async () => {
          if (message.stream_message_id) {
            try {
              await chatService.ensureConnected();
              const client = chatService.getClient();
              await client.deleteMessage(message.stream_message_id);
            } catch (err: any) {
              logger.warn("Failed to delete message in GetStream", { err });
            }
          }
        })(),
      ]);

      res.json({ message: "Message deleted" });
    } catch (error: any) {
      next(error);
    }
  };

export const markAsRead =
  (_platform: any) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = getAuth(req);
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

      // Verify channel membership before marking as read
      const message =
        await ChatMessage.findById(id).select("stream_channel_id");
      if (!message) {
        res.status(404).json({ error: { message: "Message not found" } });
        return;
      }
      const channel_id = message.stream_channel_id;

      const ChannelModel = NetworkListingChannel;
      const isMember = await ChannelModel.exists({
        getstream_channel_id: channel_id,
        $or: [{ buyer_id: user._id }, { seller_id: user._id }],
      });

      if (!isMember) {
        res
          .status(403)
          .json({ error: { message: "Not a member of this channel" } });
        return;
      }

      await ChatMessage.updateOne(
        { _id: id, "read_by.user_id": { $ne: user._id } },
        { $push: { read_by: { user_id: user._id, read_at: new Date() } } },
      );

      res.json({ message: "Marked as read" });
    } catch (error: any) {
      next(error);
    }
  };

export const markAllAsRead =
  (_platform: any) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = getAuth(req);
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

      // Membership check for markAllAsRead
      const ChannelModel = NetworkListingChannel;
      const isMember = await ChannelModel.exists({
        getstream_channel_id: channelId,
        $or: [{ buyer_id: user._id }, { seller_id: user._id }],
      });

      if (!isMember) {
        res
          .status(403)
          .json({ error: { message: "Not a member of this channel" } });
        return;
      }

      await ChatMessage.updateMany(
        { stream_channel_id: channelId, "read_by.user_id": { $ne: user._id } },
        { $push: { read_by: { user_id: user._id, read_at: new Date() } } },
      );

      res.json({ message: "All messages marked as read" });
    } catch (error: any) {
      next(error);
    }
  };

export const reactToMessage =
  (_platform: any) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { id } = req.params;
      const { type } = req.body;

      if (!type) {
        res
          .status(400)
          .json({ error: { message: "Reaction type is required" } });
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

      // Membership check for reactions
      const ChannelModel = NetworkListingChannel;
      const isMember = await ChannelModel.exists({
        getstream_channel_id: message.stream_channel_id,
        $or: [{ buyer_id: user._id }, { seller_id: user._id }],
      });

      if (!isMember) {
        res
          .status(403)
          .json({ error: { message: "Not a member of this channel" } });
        return;
      }

      await Promise.all([
        ChatMessage.updateOne(
          {
            _id: id,
            reactions: { $not: { $elemMatch: { user_id: user._id, type } } },
          },
          {
            $push: {
              reactions: { user_id: user._id, type, created_at: new Date() },
            },
          },
        ),
        (async () => {
          if (message.stream_message_id) {
            try {
              await chatService.ensureConnected();
              const client = chatService.getClient();
              const channel = client.channel(
                "messaging",
                message.stream_channel_id,
              );
              await channel.sendReaction(message.stream_message_id, {
                type,
                user_id: auth.userId,
              });
            } catch (err: any) {
              logger.warn("Failed to add reaction in GetStream", { err });
            }
          }
        })(),
      ]);

      res.json({ message: "Reaction added" });
    } catch (error: any) {
      next(error);
    }
  };

export const archiveChannel =
  (_platform: any) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = getAuth(req);
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

      // Verify channel membership before allowing archive (hide)
      const ChannelModel = NetworkListingChannel;
      const q = {
        getstream_channel_id: channelId,
        $or: [{ buyer_id: user._id }, { seller_id: user._id }],
      };

      const channel_exists = await ChannelModel.exists(q);

      if (!channel_exists) {
        res
          .status(403)
          .json({ error: { message: "Not a member of this channel" } });
        return;
      }

      try {
        await chatService.ensureConnected();
        const client = chatService.getClient();
        const streamChannel = client.channel("messaging", channelId);

        await streamChannel.hide(auth.userId, false);
      } catch (chatError: any) {
        logger.warn("Failed to archive channel in GetStream", {
          error: chatError,
          channelId,
        });
        res.status(503).json({
          error: { message: "Could not archive channel at this time" },
        });
        return;
      }

      res.json({ message: "Channel archived" });
    } catch (error: any) {
      next(error);
    }
  };
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
 * Architecture: Message persistence to MongoDB via ChatMessage.create happens first,
 * and then GetStream delivery via sendMessage is performed.
 */

/**
 * @swagger
 * /api/v1/messages/send:
 *   post:
 *     summary: Send a message through backend
 *     description: |
 *       Stores message in MongoDB first via ChatMessage.create,
 *       and then delivers via GetStream sendMessage.
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
 *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]
 *     responses:
 *       201:
 *         description: Message sent and stored
 */

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
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]
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

/**
 * @swagger
 * /api/v1/messages/{id}:
 *   put:
 *     summary: Edit a message (updates both MongoDB and GetStream)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/v1/messages/{id}:
 *   delete:
 *     summary: Delete a message (soft delete in both MongoDB and GetStream)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/v1/messages/{id}/read:
 *   post:
 *     summary: Mark message as read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/v1/messages/channel/{channelId}/read-all:
 *   post:
 *     summary: Mark all messages in channel as read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/v1/messages/{id}/react:
 *   post:
 *     summary: Add reaction to a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/v1/messages/channel/{channelId}/archive:
 *   post:
 *     summary: Archive a channel for the current user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
