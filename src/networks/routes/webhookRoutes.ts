import { Router, Request, Response, NextFunction, raw } from "express";
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
 * Verify GetStream webhook signature using raw request body bytes
 * Computes HMAC on exact raw bytes and uses timing-safe comparison
 *
 * @param signatureHeader - X-Signature header value
 * @param rawBody - Raw request body bytes (Buffer)
 * @returns true if signature is valid
 */
function verifyWebhookSignature(
  signatureHeader: string | undefined,
  rawBody: Buffer,
): boolean {
  if (!signatureHeader || !GETSTREAM_WEBHOOK_SECRET) {
    logger.warn("Missing webhook signature or secret");
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", GETSTREAM_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const providedBuffer = Buffer.from(signatureHeader.trim(), "utf8");

    // Return false if lengths differ (prevents length-based timing leaks)
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    // Compare with constant-time algorithm (same time regardless of mismatch position)
    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } catch (err) {
    logger.error("Webhook signature verification error", { error: err });
    return false;
  }
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
 *
 * ✅ SECURITY: Uses raw() middleware to capture exact request body
 * for signature verification before JSON parsing
 */
router.post(
  "/getstream/chat",
  raw({ type: "application/json" }), // ✅ Capture raw body bytes
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      // ✅ Extract raw body and signature header
      const signature = req.headers["x-signature"] as string | undefined;
      const rawBody = req.body as Buffer;

      // ✅ Verify webhook signature against exact raw bytes
      if (
        !Buffer.isBuffer(rawBody) ||
        !verifyWebhookSignature(signature, rawBody)
      ) {
        logger.warn("Invalid webhook signature", {
          ip: req.ip,
          path: req.path,
          signaturePresent: !!signature,
        });
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      // ✅ Parse JSON AFTER signature verification
      const parsed = JSON.parse(rawBody.toString("utf8")) as {
        type?: string;
        data?: any;
      };
      const { type, data } = parsed;

      logger.debug("Webhook received and verified", {
        type,
        channelId: data?.channel?.cid,
      });

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
