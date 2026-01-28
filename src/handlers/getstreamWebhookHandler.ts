/**
 * GetStream Webhook Handler
 *
 * Async-ready webhook handler following the Finix pattern:
 * 1. Verify signature using Stream SDK
 * 2. Check for duplicate events (idempotency)
 * 3. Persist raw webhook to GetstreamWebhookEvent collection
 * 4. Enqueue for async processing via Bull
 * 5. Return 200 OK immediately (<200ms target)
 */

import { Request, Response, NextFunction } from "express";
import { chatService } from "../services/ChatService";
import { GetstreamWebhookEvent } from "../models/GetstreamWebhookEvent";
import { WebhookEvent } from "../models/WebhookEvent";
import webhookQueue from "../queues/webhookQueue";
import { webhookLogger, logWebhookEvent } from "../utils/logger";

/**
 * Handle GetStream webhook events
 * POST /api/v1/webhooks/getstream
 *
 * Flow:
 * 1. Verify HMAC signature using Stream SDK
 * 2. Check for duplicate events (idempotency)
 * 3. Persist raw webhook to GetstreamWebhookEvent collection
 * 4. Enqueue for async processing via Bull
 * 5. Return 200 OK immediately
 */
export const webhook_getstream_post = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const startTime = Date.now();

  // Log incoming request for debugging
  webhookLogger.debug("🔥 Incoming GetStream webhook request", {
    method: req.method,
    url: req.url,
    headers: {
      "content-type": req.headers["content-type"],
      "x-signature": req.headers["x-signature"] ? "[PRESENT]" : "[MISSING]",
      "x-webhook-id": req.headers["x-webhook-id"],
      "x-webhook-attempt": req.headers["x-webhook-attempt"],
      "x-api-key": req.headers["x-api-key"] ? "[PRESENT]" : "[MISSING]",
    },
    bodyType: req.body?.type,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  try {
    // Step 1: Verify HMAC signature using Stream SDK
    const signature = req.headers["x-signature"] as string;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    
    // Use Stream SDK's verifyWebhook method
    const streamClient = chatService.getClient();
    const isValid = streamClient.verifyWebhook(rawBody, signature);

    if (!isValid) {
      webhookLogger.error("❌ Invalid GetStream webhook signature", {
        webhookId: req.headers["x-webhook-id"],
        ip: req.ip,
      });
      res.status(401).json({
        success: false,
        message: "Invalid webhook signature",
      });
      return;
    }

    // Step 2: Handle empty/ping requests
    if (!req.body || Object.keys(req.body).length === 0) {
      webhookLogger.info("🏓 GetStream webhook ping received", {
        webhookId: req.headers["x-webhook-id"],
        ip: req.ip,
      });
      res.status(200).json({ ok: true, ping: true });
      return;
    }

    // Step 3: Extract event info
    const eventId = (req.headers["x-webhook-id"] as string) || 
                    `getstream_${req.body.type}_${Date.now()}`;
    const eventType = req.body.type || "unknown";
    const attemptNumber = parseInt(req.headers["x-webhook-attempt"] as string) || 1;

    logWebhookEvent(eventType, eventId, {
      webhookId: eventId,
      attempt: attemptNumber,
      ip: req.ip,
    });

    // Step 4: Idempotency check using GetstreamWebhookEvent
    const existingEvent = await GetstreamWebhookEvent.findOne({ eventId });
    if (existingEvent) {
      if (existingEvent.status === "processed") {
        webhookLogger.info(
          `⏭️ GetStream webhook ${eventId} already processed, skipping`,
          {
            eventId,
            status: existingEvent.status,
            eventType,
          }
        );
        res.status(200).json({
          success: true,
          message: "Already processed",
          eventId,
        });
        return;
      }

      // Event exists but not processed - could be retry
      webhookLogger.info(
        `🔄 GetStream webhook ${eventId} exists with status: ${existingEvent.status}`,
        {
          eventId,
          status: existingEvent.status,
          attemptCount: existingEvent.attemptCount,
        }
      );
    }

    // Step 5: Persist raw webhook event for traceability (GetStream-specific)
    if (!existingEvent) {
      await GetstreamWebhookEvent.create({
        eventId,
        eventType,
        payload: req.body,
        headers: req.headers as Record<string, string>,
        status: "pending",
        receivedAt: new Date(),
        attemptCount: 0,
      });
    }

    // Step 6: Also save to WebhookEvent for unified tracking
    const webhookEventDoc = await WebhookEvent.findOneAndUpdate(
      { eventId },
      {
        eventId,
        provider: "getstream",
        type: eventType,
        payload: req.body,
        status: "received",
        data: { attemptNumber },
      },
      { upsert: true, new: true }
    );

    // Step 7: Enqueue job for async processing
    const job = await webhookQueue.add({
      webhookEventId: (webhookEventDoc!._id as any).toString(),
      eventId,
      provider: "getstream",
      type: eventType,
      payload: req.body,
    });

    const processingTime = Date.now() - startTime;
    webhookLogger.info(
      `✅ Enqueued GetStream webhook ${eventId} as job ${job.id} (${processingTime}ms)`,
      {
        eventId,
        eventType,
        jobId: job.id,
        processingTime,
      }
    );

    // Step 8: Return 200 OK immediately (<200ms target)
    res.status(200).json({
      success: true,
      message: "Webhook received and enqueued",
      eventId,
      jobId: job.id,
      processingTime,
    });
  } catch (err: any) {
    const processingTime = Date.now() - startTime;
    webhookLogger.error(
      `❌ GetStream webhook handler error (${processingTime}ms)`,
      {
        error: err.message || err,
        stack: err.stack,
      }
    );

    // Always return 200 to prevent GetStream retries for signature/parsing errors
    // GetStream will retry on non-2xx responses
    res.status(200).json({
      received: true,
      error: "Processing failed",
      processingTime,
    });
  }
};
