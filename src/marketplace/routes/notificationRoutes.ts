/**
 * Marketplace Notification Routes
 *
 * Endpoints for managing notifications specific to the Marketplace platform.
 * Mounted at: /api/v1/marketplace/notifications
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { marketplaceNotificationService } from "../services/NotificationService";
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
 * GET /api/v1/marketplace/notifications
 * Get marketplace notifications for current user
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
        marketplaceNotificationService.getForUser(user._id.toString(), {
          limit,
          offset,
          unreadOnly,
        }),
        marketplaceNotificationService.getUnreadCount(user._id.toString()),
      ]);

      res.json({
        platform: "marketplace",
        data: notifications,
        total: notifications.length,
        unread_count: unreadCount,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/marketplace/notifications/unread-count
 * Get unread count for marketplace notifications
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

      const count = await marketplaceNotificationService.getUnreadCount(
        user._id.toString(),
      );
      res.json({ platform: "marketplace", unread_count: count });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/marketplace/notifications/:id/read
 * Mark marketplace notification as read
 */
router.post(
  "/:id/read",
  validateRequest(notificationIdSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { id } = req.params;
      // TODO: Add authorization check when persistence is implemented
      // Verify notification.user_id === user._id before marking as read
      await marketplaceNotificationService.markAsRead(id);
      res.json({ platform: "marketplace", success: true, id });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/marketplace/notifications/mark-all-read
 * Mark all marketplace notifications as read
 */
router.post(
  "/mark-all-read",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      await marketplaceNotificationService.markAllAsRead(user._id.toString());
      res.json({ platform: "marketplace", success: true });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/v1/marketplace/notifications/:id
 * Delete marketplace notification
 */
router.delete(
  "/:id",
  validateRequest(notificationIdSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { id } = req.params;
      // TODO: Add authorization check when persistence is implemented
      // Verify notification.user_id === user._id before deleting
      await marketplaceNotificationService.delete(id);
      res.json({ platform: "marketplace", success: true, id });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
