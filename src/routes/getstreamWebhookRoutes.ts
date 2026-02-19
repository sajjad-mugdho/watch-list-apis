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

import { Router } from "express";

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

export { router as getstreamWebhookRoutes };
