import { Request, Response, NextFunction } from "express";
import { channelContextService } from "../../services/ChannelContextService";
import { User } from "../../models/User";
import logger from "../../utils/logger";

const PLATFORM = "networks";

export const getConversations = async (
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
      PLATFORM,
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
    logger.error("[NetworksConversationHandlers] Failed to get conversations", {
      error,
    });
    next(error);
  }
};

export const searchConversations = async (
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
      PLATFORM,
    );

    res.json({
      data: conversations,
      query: q,
      total: conversations.length,
    });
  } catch (error: any) {
    logger.error("[NetworksConversationHandlers] Search failed", { error });
    next(error);
  }
};

export const getConversationContext = async (
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

    const user = await User.findOne({ external_id: auth.userId });
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const { id } = req.params;

    const context = await channelContextService.getChannelContext(id, PLATFORM);

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
    logger.error("[NetworksConversationHandlers] Failed to get conversation", {
      error,
    });
    next(error);
  }
};

export const getConversationMedia = async (
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

    const user = await User.findOne({ external_id: auth.userId });
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const { id } = req.params;
    const VALID_MEDIA_TYPES = ["image", "video", "file", "url_enrichment", "all"] as const;
    const rawType = req.query.type as string;
    const type = (
      VALID_MEDIA_TYPES.includes(rawType as any) ? rawType : "all"
    ) as "image" | "video" | "file" | "url_enrichment" | "all";
    const parsedMediaLimit = parseInt(req.query.limit as string, 10);
    const limit = Math.min(
      !isNaN(parsedMediaLimit) ? Math.max(1, parsedMediaLimit) : 20,
      100,
    );
    const nextToken = req.query.next as string;

    const context = await channelContextService.getChannelContext(id, PLATFORM);

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
    logger.error("[NetworksConversationHandlers] Failed to get shared media", {
      error,
    });
    next(error);
  }
};
