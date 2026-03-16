/**
 * User Notification Routes (Platform Router)
 *
 * Routes that delegate to platform-specific notification endpoints.
 *
 * DEPRECATED - Use platform-specific routes instead:
 * - Networks notifications: GET /api/v1/networks/notifications
 * - Marketplace notifications: GET /api/v1/marketplace/notifications
 *
 * This route now serves as a router that explains the new structure.
 * Future clients should use the platform-specific endpoints above.
 */

import { Router, Response } from "express";

const router = Router();

/**
 * GET /api/v1/user/notifications
 *
 * Deprecated: Returns information about platform-specific notification endpoints
 * instead of aggregating notifications.
 */
router.get("/", (_req, res: Response) => {
  res.json({
    message: "Notifications have been segregated by platform",
    deprecation:
      "This endpoint is deprecated. Use platform-specific endpoints instead.",
    endpoints: {
      networks: {
        description:
          "Connection requests, reference checks, messages, orders, etc.",
        routes: {
          all: "GET /api/v1/networks/notifications",
          unreadCount: "GET /api/v1/networks/notifications/unread-count",
          markAsRead: "POST /api/v1/networks/notifications/:id/read",
          markAllAsRead: "POST /api/v1/networks/notifications/mark-all-read",
          delete: "DELETE /api/v1/networks/notifications/:id",
        },
      },
      marketplace: {
        description: "Orders, offers, listings, payments, refunds, etc.",
        routes: {
          all: "GET /api/v1/marketplace/notifications",
          unreadCount: "GET /api/v1/marketplace/notifications/unread-count",
          markAsRead: "POST /api/v1/marketplace/notifications/:id/read",
          markAllAsRead: "POST /api/v1/marketplace/notifications/mark-all-read",
          delete: "DELETE /api/v1/marketplace/notifications/:id",
        },
      },
    },
  });
});

/**
 * GET /api/v1/user/notifications/unread-count
 *
 * Deprecated: Returns information about platform-specific unread count endpoints.
 */
router.get("/unread-count", (_req, res: Response) => {
  res.json({
    message: "Use platform-specific unread count endpoints",
    networks: "GET /api/v1/networks/notifications/unread-count",
    marketplace: "GET /api/v1/marketplace/notifications/unread-count",
  });
});

export default router;
