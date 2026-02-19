import { Request, Response, NextFunction } from "express";
import { Notification } from "../models/Notification";
import { ApiResponse } from "../types";
import { DatabaseError, MissingUserContextError } from "../utils/errors";
import { User } from "../models/User";

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

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get internal user ID
    const user = await User.findOne({ external_id: auth.userId });
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const platform = req.headers["x-platform"] as string;
    const query: any = { user_id: user._id };
    if (platform === "marketplace" || platform === "networks") {
      query.$or = [{ platform }, { platform: { $exists: false } }]; // Fallback for old records
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const unread_count = await Notification.countDocuments({
      ...query,
      is_read: false,
    });

    const response: ApiResponse<any> = {
      data: notifications,
      _metadata: {
        total,
        limit,
        offset,
        unread_count,
      },
      requestId: req.headers["x-request-id"] as string,
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

    const platform = req.headers["x-platform"] as string;
    const query: any = { user_id: user._id, is_read: false };
    if (platform === "marketplace" || platform === "networks") {
      query.$or = [{ platform }, { platform: { $exists: false } }];
    }

    await Notification.updateMany(
      query,
      { $set: { is_read: true, read_at: new Date() } }
    );

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    next(new DatabaseError("Failed to mark notifications read", error));
  }
};
