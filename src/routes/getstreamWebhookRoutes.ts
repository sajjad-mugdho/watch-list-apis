/**
 * GetStream Webhooks Handler
 * 
 * Receives webhooks from GetStream Cloud for:
 * - Storing messages in MongoDB
 * - Applying business logic
 * - Analytics and tracking
 * - Moderation and compliance
 * - Custom notifications
 * 
 * Uses async Bull queue processing for reliability and performance.
 */

import { Router, Request, Response, NextFunction } from "express";
import { ChatMessage } from "../models/ChatMessage";
import { webhook_getstream_post } from "../handlers/getstreamWebhookHandler";

const router = Router();

// ----------------------------------------------------------
// Webhook Endpoint
// ----------------------------------------------------------

/**
 * @swagger
 * /api/v1/webhooks/getstream:
 *   post:
 *     summary: GetStream webhook handler
 *     tags: [Webhooks]
 *     description: Receives events from GetStream Cloud for tracking and business logic.
 *                  Uses async Bull queue processing for reliability and performance.
 */
router.post("/", webhook_getstream_post);

// ----------------------------------------------------------
// Analytics Endpoints (for dashboard)
// ----------------------------------------------------------

router.get(
  "/analytics/messages",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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
  }
);

router.get(
  "/messages/listing/:listingId",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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
  }
);

export { router as getstreamWebhookRoutes };
