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
  try {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      throw new MissingUserContextError({
        route: req.path,
        note: "req.auth missing in getNotifications",
      });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get internal user ID
    const user = await User.findOne({ external_id: auth.userId });
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const notifications = await Notification.find({ user_id: user._id })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments({ user_id: user._id });
    const unread_count = await Notification.countDocuments({
      user_id: user._id,
      read: false,
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
  try {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      throw new MissingUserContextError({
        route: req.path,
        note: "req.auth missing in markAllRead",
      });
    }

    const user = await User.findOne({ external_id: auth.userId });
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    await Notification.updateMany(
      { user_id: user._id, read: false },
      { $set: { read: true, read_at: new Date() } }
    );

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    next(new DatabaseError("Failed to mark notifications read", error));
  }
};
