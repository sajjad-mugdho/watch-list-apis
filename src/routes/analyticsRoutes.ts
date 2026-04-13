import { Router, Request, Response, NextFunction } from "express";
import { ChatMessage } from "../networks/models/ChatMessage";

const router = Router();

/**
 * @swagger
 * /api/v1/analytics/messages:
 *   get:
 *     summary: Get message analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/messages",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      // Optional: Add admin check if this is for admin dashboard

      const { startDate, endDate, listingId, userId } = req.query;

      const query: any = {};

      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string),
        };
      }

      if (listingId) {
        query.listing_id = listingId;
      }

      if (userId) {
        query.sender_id = userId;
      }

      const totalMessages = await ChatMessage.countDocuments(query);
      const uniqueUsers = await ChatMessage.distinct("sender_id", query);
      const messagesByType = await ChatMessage.aggregate([
        { $match: query },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]);

      res.json({
        total_messages: totalMessages,
        unique_users: uniqueUsers.length,
        messages_by_type: messagesByType,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/analytics/listing/{listingId}/messages:
 *   get:
 *     summary: Get messages for a specific listing
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/listing/:listingId/messages",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { listingId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      const messages = await ChatMessage.getMessagesByListing(listingId, limit);

      res.json({
        data: messages,
        total: messages.length,
      });
    } catch (error) {
      next(error);
    }
  },
);

export { router as analyticsRoutes };
