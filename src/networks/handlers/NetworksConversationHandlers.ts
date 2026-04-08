import { Request, Response, NextFunction } from "express";
import { channelContextService } from "../../services/ChannelContextService";
import { User } from "../../models/User";
import logger from "../../utils/logger";
import { ApiResponse } from "../../types";

/**
 * NetworksConversationHandlers
 * All successful responses follow ApiResponse envelope: { data, _metadata, requestId }
 * All list endpoints include pagination metadata: { limit, offset, total }
 * Error responses are handled via error middleware and standardized globally
 */

const PLATFORM = "networks";

const getRequestId = (req: Request): string =>
  (req.headers["x-request-id"] as string) || "";

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
      _metadata: {
        limit,
        offset,
        total,
      },
      requestId: getRequestId(req),
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
      _metadata: {
        query: q,
        total: conversations.length,
      },
      requestId: getRequestId(req),
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

    res.json({ data: context, requestId: getRequestId(req) });
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
    const VALID_MEDIA_TYPES = [
      "image",
      "video",
      "file",
      "url_enrichment",
      "media",
      "files",
      "links",
      "all",
    ] as const;
    const rawType = req.query.type as string;
    const normalizedType =
      rawType === "media"
        ? "image"
        : rawType === "files"
          ? "file"
          : rawType === "links"
            ? "url_enrichment"
            : rawType;
    const type = (
      VALID_MEDIA_TYPES.includes(normalizedType as any) ? normalizedType : "all"
    ) as "image" | "video" | "file" | "url_enrichment" | "all";
    const canonicalType =
      type === "image"
        ? "media"
        : type === "file"
          ? "files"
          : type === "url_enrichment"
            ? "links"
            : type;
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

    const responseData =
      mediaResponse &&
      typeof mediaResponse === "object" &&
      "data" in mediaResponse
        ? (mediaResponse as any).data
        : mediaResponse;

    const compatibilityMeta =
      mediaResponse && typeof mediaResponse === "object"
        ? Object.fromEntries(
            Object.entries(mediaResponse as any).filter(([k]) => k !== "data"),
          )
        : {};

    // Standardized response envelope for shared-content with canonical type
    const response: ApiResponse<any> = {
      data: responseData,
      _metadata: {
        type: canonicalType,
        canonical_type: canonicalType,
        limit,
        next: compatibilityMeta.next || undefined,
        ...compatibilityMeta,
      },
      requestId: getRequestId(req),
    };
    res.json(response);
  } catch (error: any) {
    logger.error("[NetworksConversationHandlers] Failed to get shared media", {
      error,
    });
    next(error);
  }
};
