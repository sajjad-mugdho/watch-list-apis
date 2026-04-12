import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { chatService } from "../../services/ChatService";
import { networksChatService } from "../services/NetworksChatService";
import { User } from "../../models/User";
import { getOrCreateUser } from "../../utils/user";
import logger from "../../utils/logger";
import { NetworksChannelRepository } from "../repositories/NetworksChannelRepository";

/**
 * Generate Stream Chat token for Networks
 */
export const generateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      res.status(401).json({ error: { message: "Unauthorized" } });
      return;
    }

    const user = await getOrCreateUser(auth.userId);
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const userId = user._id.toString();
    const token = chatService.createUserToken(userId);

    await chatService.upsertUser({
      id: userId,
      name:
        user.display_name ||
        `${user.first_name} ${user.last_name}`.trim() ||
        "Anonymous",
      ...(user.avatar && { avatar: user.avatar }),
    });

    logger.info("Chat token generated", { userId, platform: "networks" });

    res.json({
      token,
      userId,
      apiKey: process.env.GETSTREAM_API_KEY,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get user's chat channels for Networks
 */
export const getUserChannels = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      res.status(401).json({ error: { message: "Unauthorized" } });
      return;
    }

    const user = await getOrCreateUser(auth.userId);
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const channels = await chatService.getUserChannels(
      user._id.toString(),
      limit,
      offset,
    );

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

    res.json({ channels: channelData, limit, offset });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get unread message counts for Networks
 */
export const getUnreadCounts = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      res.status(401).json({ error: { message: "Unauthorized" } });
      return;
    }

    const user = await getOrCreateUser(auth.userId);
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const unreadCounts = await chatService.getUnreadCounts(user._id.toString());
    res.json(unreadCounts);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Create or get a chat channel for a listing (Networks)
 */
export const getOrCreateChannel = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      res.status(401).json({ error: { message: "Unauthorized" } });
      return;
    }

    const user = await getOrCreateUser(auth.userId);
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
      res
        .status(400)
        .json({ error: { message: "listing_id and seller_id are required" } });
      return;
    }

    // Look up seller by external_id (Clerk ID) or MongoDB ID
    let seller = await User.findOne({ external_id: seller_id });

    // If not found by external_id and it's a valid MongoDB ObjectId, try by ID
    if (!seller && mongoose.Types.ObjectId.isValid(seller_id)) {
      seller = await User.findById(seller_id);
    }

    if (!seller) {
      res.status(404).json({ error: { message: "Seller not found" } });
      return;
    }

    // Check if buyer and seller are the same user
    const buyerClerkId = user.external_id || user._id.toString();
    const sellerClerkId = seller.external_id || seller._id.toString();

    if (buyerClerkId === sellerClerkId) {
      res
        .status(400)
        .json({ error: { message: "Cannot create channel with yourself" } });
      return;
    }

    // Upsert both users to GetStream before creating channel
    // This ensures they exist in GetStream (required before channel.create())
    try {
      await chatService.upsertUser({
        id: user._id.toString(),
        name:
          user.display_name ||
          `${user.first_name} ${user.last_name}`.trim() ||
          "Anonymous",
        ...(user.avatar && { avatar: user.avatar }),
      });

      await chatService.upsertUser({
        id: seller._id.toString(),
        name:
          seller.display_name ||
          `${seller.first_name} ${seller.last_name}`.trim() ||
          "Anonymous",
        ...(seller.avatar && { avatar: seller.avatar }),
      });
    } catch (upsertError) {
      logger.error("Failed to upsert users to GetStream Chat", { upsertError });
      // Continue anyway - some of the users might already exist
    }

    const { channel, channelId } = await chatService.getOrCreateChannel(
      user._id.toString(),
      seller._id.toString(),
      { listing_id, listing_title, listing_price, listing_thumbnail },
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
        members: [user._id.toString(), seller._id.toString()],
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Mark a channel as read
 * Called by client when user opens/reads messages in a channel
 */
export const markChannelAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      res.status(401).json({ error: { message: "Unauthorized" } });
      return;
    }

    const user = await getOrCreateUser(auth.userId);
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const { channelId } = req.body;
    if (!channelId) {
      res.status(400).json({ error: { message: "channelId is required" } });
      return;
    }

    const channelRepo = new NetworksChannelRepository();

    // Verify user is member of this channel
    const isMember = await channelRepo.isMember(channelId, user._id.toString());
    if (!isMember) {
      res
        .status(403)
        .json({ error: { message: "Not a member of this channel" } });
      return;
    }

    // Clear unread count in database
    const updated = await channelRepo.clearUnreadCount(channelId);
    if (!updated) {
      res.status(404).json({ error: { message: "Channel not found" } });
      return;
    }

    // Mark as read in GetStream as well
    try {
      await networksChatService.markChannelAsRead(
        channelId,
        user._id.toString(),
      );
    } catch (error) {
      // Log error but don't fail the response
      logger.warn("Failed to mark channel as read in GetStream", {
        channelId,
        error,
      });
    }

    res.json({
      ok: true,
      channel: {
        id: updated._id,
        unread_count: updated.unread_count,
        last_read_at: updated.last_read_at,
      },
    });
  } catch (error: any) {
    next(error);
  }
};
