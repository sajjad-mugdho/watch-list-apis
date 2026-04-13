import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import logger from "../../utils/logger";
import { ChatMessageWebhookHandler } from "../handlers/ChatMessageWebhookHandler";
import { NetworksChannelRepository } from "../repositories/NetworksChannelRepository";

const router = Router();
const channelRepo = new NetworksChannelRepository();
const webhookHandler = new ChatMessageWebhookHandler(channelRepo);

// GetStream webhook secret for signature verification
const GETSTREAM_WEBHOOK_SECRET = process.env.GETSTREAM_WEBHOOK_SECRET || "";

/**
 * Verify GetStream webhook signature
 * GetStream sends a X-Signature header with HMAC-SHA256 hash of the request body
 */
function verifyWebhookSignature(req: Request): boolean {
  const signature = req.headers["x-signature"] as string;
  if (!signature || !GETSTREAM_WEBHOOK_SECRET) {
    logger.warn("Missing webhook signature or secret");
    return false;
  }

  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac("sha256", GETSTREAM_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  return hash === signature;
}

/**
 * POST /webhooks/getstream/chat
 * Handle incoming GetStream webhook events
 *
 * Supported events:
 * - message.new: New message received
 * - message.updated: Message was edited
 * - message.deleted: Message was deleted
 * - channel.updated: Channel metadata changed
 */
router.post(
  "/getstream/chat",
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      // Verify webhook signature
      if (!verifyWebhookSignature(req)) {
        logger.warn("Invalid webhook signature", {
          ip: req.ip,
          path: req.path,
        });
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      const { type, data } = req.body;

      logger.debug("Webhook received", { type, channelId: data?.channel?.cid });

      // Route to appropriate handler based on event type
      switch (type) {
        case "message.new":
          await webhookHandler.handleMessageNew(data);
          break;
        case "message.updated":
          await webhookHandler.handleMessageUpdated(data);
          break;
        case "message.deleted":
          await webhookHandler.handleMessageDeleted(data);
          break;
        case "channel.updated":
          await webhookHandler.handleChannelUpdated(data);
          break;
        default:
          logger.debug("Unhandled webhook type", { type });
      }

      // Always return 200 to acknowledge receipt
      res.json({ ok: true });
    } catch (error) {
      logger.error("Error processing webhook", error);
      // Return 200 anyway to prevent GetStream retries
      res.json({ ok: true });
    }
  },
);

export default router;
