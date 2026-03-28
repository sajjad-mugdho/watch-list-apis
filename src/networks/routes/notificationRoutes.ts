/**
 * Networks Notification Routes
 *
 * Endpoints for managing notifications specific to the Networks platform.
 * Mounted at: /api/v1/networks/notifications
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { networksNotificationService } from "../services/NotificationService";
import { validateRequest } from "../../middleware/validation";
import { User } from "../../models/User";

const router = Router();

// Validation Schemas
const getNotificationsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    unread_only: z.enum(["true", "false"]).optional().default("false"),
    types: z.string().optional(), // comma-separated notification type filters
    tab: z
      .enum(["all", "buying", "selling", "social", "system"])
      .optional()
      .default("all"),
  }),
});

const markAllReadSchema = z.object({
  query: z.object({
    tab: z
      .enum(["all", "buying", "selling", "social", "system"])
      .optional()
      .default("all"),
  }),
});

const notificationIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

/**
 * GET /api/v1/networks/notifications
 * Get networks notifications for current user
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

      const { limit, offset, unread_only, types, tab } = req.query as any;
      const unreadOnly = unread_only === "true";
      const categories = tab && tab !== "all" ? [tab] : undefined;
      const typeFilters =
        typeof types === "string" && types.trim().length > 0
          ? types
              .split(",")
              .map((t: string) => t.trim())
              .filter(Boolean)
          : undefined;

      const notificationOptions: {
        limit: number;
        offset: number;
        unreadOnly: boolean;
        types?: string[];
        categories?: Array<"buying" | "selling" | "social" | "system">;
      } = {
        limit,
        offset,
        unreadOnly,
      };
      if (typeFilters && typeFilters.length > 0) {
        notificationOptions.types = typeFilters;
      }
      if (categories && categories.length > 0) {
        notificationOptions.categories = categories;
      }

      const totalCountOptions: {
        unreadOnly: boolean;
        types?: string[];
        categories?: Array<"buying" | "selling" | "social" | "system">;
      } = {
        unreadOnly,
      };
      if (typeFilters && typeFilters.length > 0) {
        totalCountOptions.types = typeFilters;
      }
      if (categories && categories.length > 0) {
        totalCountOptions.categories = categories;
      }

      const [notifications, unreadCount, total] = await Promise.all([
        networksNotificationService.getForUser(
          user._id.toString(),
          notificationOptions,
        ),
        networksNotificationService.getUnreadCount(user._id.toString(), {
          ...(typeFilters && typeFilters.length > 0
            ? { types: typeFilters }
            : {}),
          ...(categories && categories.length > 0 ? { categories } : {}),
        }),
        networksNotificationService.getTotalCount(
          user._id.toString(),
          totalCountOptions,
        ),
      ]);

      res.json({
        platform: "networks",
        data: notifications,
        total,
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
 * GET /api/v1/networks/notifications/unread-count
 * Get unread count for networks notifications
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

      const count = await networksNotificationService.getUnreadCount(
        user._id.toString(),
      );
      res.json({ platform: "networks", unread_count: count });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/networks/notifications/:id/read
 * Mark networks notification as read
 */
router.post(
  "/:id/read",
  validateRequest(notificationIdSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await networksNotificationService.markAsRead(id);
      res.json({ platform: "networks", success: true, id });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/networks/notifications/mark-all-read
 * Mark all networks notifications as read
 */
router.post(
  "/mark-all-read",
  validateRequest(markAllReadSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const tab = (req.query as any).tab;
      const categories = tab && tab !== "all" ? [tab] : undefined;

      await networksNotificationService.markAllAsRead(user._id.toString(), {
        ...(categories && categories.length > 0 ? { categories } : {}),
      });
      res.json({ platform: "networks", success: true });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/v1/networks/notifications/:id
 * Delete networks notification
 */
router.delete(
  "/:id",
  validateRequest(notificationIdSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await networksNotificationService.delete(id);
      res.json({ platform: "networks", success: true, id });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
