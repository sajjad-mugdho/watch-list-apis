/**
 * User Notification Routes
 * 
 * Endpoints for managing notifications for the current authenticated user.
 * Mounted at: /api/v1/user/notifications
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { notificationService } from "../../services";
import { validateRequest } from "../../middleware/validation";
import { User } from "../../models/User";

const router = Router();

// Validation Schemas
const getNotificationsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    unread_only: z.enum(["true", "false"]).optional().default("false"),
  }),
});

const notificationIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

/**
 * GET /api/v1/user/notifications
 * Get notifications for the current user
 */
router.get(
  "/",
  validateRequest(getNotificationsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { limit, offset, unread_only } = req.query as any;
      const unreadOnly = unread_only === "true";

      const [notifications, unreadCount] = await Promise.all([
        (notificationService as any).notificationRepository?.getForUser(
          user._id.toString(), 
          { limit, offset, unreadOnly }
        ) ?? [],
        notificationService.getUnreadCount(user._id.toString())
      ]);

      const total = await (notificationService as any).notificationRepository?.countDocuments({
        user_id: user._id
      }) ?? notifications.length;

      res.json({
        data: notifications,
        total,
        unread_count: unreadCount,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/user/notifications/unread-count
 */
router.get(
  "/unread-count",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const count = await notificationService.getUnreadCount(user._id.toString());
      res.json({ unread_count: count });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/user/notifications/:id/read
 */
router.post(
  "/:id/read",
  validateRequest(notificationIdSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { id } = req.params;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      await notificationService.markAsRead(id, user._id.toString());
      res.json({ success: true, message: "Notification marked as read" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/user/notifications/read-all
 */
router.post(
  "/read-all",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const count = await notificationService.markAllAsRead(user._id.toString());
      res.json({ success: true, message: "All notifications marked as read", count });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/user/notifications/:id
 */
router.delete(
  "/:id",
  validateRequest(notificationIdSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { id } = req.params;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const deleted = await (notificationService as any).notificationRepository?.deleteOne({
        _id: id,
        user_id: user._id
      });

      if (!deleted || deleted.deletedCount === 0) {
        res.status(404).json({ error: { message: "Notification not found" } });
        return;
      }

      res.json({ success: true, message: "Notification deleted" });
    } catch (error) {
      next(error);
    }
  }
);

export { router as userNotificationRoutes };
