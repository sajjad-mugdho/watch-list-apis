import { Request, Response, NextFunction } from "express";
import { chatService } from "../../services/ChatService";
import { User } from "../../models/User";
import { getOrCreateUser } from "../../utils/user";
import logger from "../../utils/logger";

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

    const seller = await User.findById(seller_id);
    if (!seller) {
      res.status(404).json({ error: { message: "Seller not found" } });
      return;
    }

    if (user._id.toString() === seller_id) {
      res
        .status(400)
        .json({ error: { message: "Cannot create channel with yourself" } });
      return;
    }

    const { channel, channelId } = await chatService.getOrCreateChannel(
      user._id.toString(),
      seller_id,
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
        members: [user._id.toString(), seller_id],
      },
    });
  } catch (error: any) {
    next(error);
  }
};
