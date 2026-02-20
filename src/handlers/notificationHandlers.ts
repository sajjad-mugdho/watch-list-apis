import { Request, Response, NextFunction } from "express";
import { Notification } from "../models/Notification";
import { ApiResponse } from "../types";
import { DatabaseError } from "../utils/errors";
import { User } from "../models/User";

/**
 * Shared helper to apply platform filtering to notification queries
 */
const applyPlatformFilter = (query: any, platform?: string) => {
  if (platform === "marketplace" || platform === "networks") {
    query.$or = [{ platform }, { platform: { $exists: false } }];
  }
};

/**
 * Get user notifications
 * GET /api/v1/notifications
 */
export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const auth = (req as any).auth;
  if (!auth?.userId) {
    res.status(401).json({ error: { message: "Unauthorized" } });
    return;
  }

  try {
    const MAX_LIMIT = 100;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), MAX_LIMIT);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    // Get internal user ID
    const user = await User.findOne({ external_id: auth.userId });
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const platform = req.headers["x-platform"] as string | undefined;
    const query: any = { user_id: user._id };
    applyPlatformFilter(query, platform);

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const [total, unread_count] = await Promise.all([
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, is_read: false }),
    ]);

    const response: ApiResponse<typeof notifications> = {
      data: notifications,
      _metadata: {
        total,
        limit,
        offset,
        unread_count,
      },
      requestId: (req.headers["x-request-id"] as string) ?? "",
    };

    res.json(response);
  } catch (error) {
    next(new DatabaseError("Failed to fetch notifications", error));
  }
};

/**
 * Mark all notifications as read
 * POST /api/v1/notifications/read-all
 */
export const markAllRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const auth = (req as any).auth;
  if (!auth?.userId) {
    res.status(401).json({ error: { message: "Unauthorized" } });
    return;
  }

  try {

    const user = await User.findOne({ external_id: auth.userId });
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const platform = req.headers["x-platform"] as string | undefined;
    const query: any = { user_id: user._id, is_read: false };
    applyPlatformFilter(query, platform);

    await Notification.updateMany(
      query,
      { $set: { is_read: true, read_at: new Date() } }
    );

    const response: ApiResponse<null> = {
      data: null,
      message: "All notifications marked as read",
      requestId: (req.headers["x-request-id"] as string) ?? "",
    };
    res.json(response);
  } catch (error) {
    next(new DatabaseError("Failed to mark notifications read", error));
  }
};
