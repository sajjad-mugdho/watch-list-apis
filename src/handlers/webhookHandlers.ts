import { User } from "../models/User";
import { verifyWebhook } from "@clerk/express/webhooks";
import { clerkClient } from "@clerk/express";
import { DatabaseError, ValidationError } from "../utils/errors";
import { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { verifyBasic, verifyFinixSignature } from "../utils/finix";
import { FinixEventSchema } from "../validation/schemas";
import { WebhookEvent } from "../models/WebhookEvent";
import { FinixWebhookEvent } from "../models/FinixWebhookEvent";
import webhookQueue from "../queues/webhookQueue";
import { webhookLogger, logWebhookEvent } from "../utils/logger";
import { events } from "../utils/events";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export interface ClerkUserData {
  email: string;
  id: string;
  first_name: string;
  last_name: string;
}

// ----------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------

export function ExtractClerkUserData(data: any): ClerkUserData | null {
  try {
    if (!data || !data.id || !data.email_addresses?.[0]?.email_address)
      return null;

    return {
      id: data.id,
      email: data.email_addresses[0].email_address,
      first_name: data.first_name || "",
      last_name: data.last_name || "",
    };
  } catch (e) {
    return null;
  }
}

/**
 * Create user in database and optionally sync metadata back to Clerk
 * Returns the created user for downstream event emission
 */
async function createUserFromClerkData(
  clerkUser: ClerkUserData
): Promise<{ userId: string; firstName: string }> {
  let newUser;
  try {
    newUser = await User.create({
      external_id: clerkUser.id,
      email: clerkUser.email,
      first_name: clerkUser.first_name,
      last_name: clerkUser.last_name,
    });
  } catch (err) {
    throw new DatabaseError("Failed to create user", err);
  }

  // FEATURE_FLAG
  if (config.featureClerkMutations) {
    try {
      await clerkClient.users.updateUserMetadata(clerkUser.id, {
        publicMetadata: { dialist_id: newUser._id },
      });
    } catch (err) {
      throw new DatabaseError("Failed to update Clerk user metadata", err);
    }
  } else {
    webhookLogger.info(
      "[webhooks/clerk] Mutations disabled; skipped updateUserMetadata.",
      { userId: clerkUser.id, dialistId: newUser._id }
    );
  }

  return {
    userId: newUser._id.toString(),
    firstName: clerkUser.first_name,
  };
}

// ----------------------------------------------------------
// Handler Functions
// ----------------------------------------------------------

/**
 * Handle Clerk webhook events
 * POST /api/v1/webhooks/clerk
 */
export const webhook_clerk_post = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const evt = await verifyWebhook(req as any, {
      signingSecret: config.clerkWebhookSigningSecret,
    });

    const eventType = evt.type as string;

    switch (eventType) {
      case "user.created": {
        const user = ExtractClerkUserData(evt.data);
        if (!user) {
          throw new ValidationError(
            "Invalid Clerk user data in webhook payload"
          );
        }
        
        // Create user and get their ID for notifications
        const newUserData = await createUserFromClerkData(user);
        
        // Emit welcome event to trigger notification
        events.emit('user:registered', {
          userId: newUserData.userId,
          email: user.email,
          firstName: newUserData.firstName,
        });
        
        webhookLogger.info("[webhooks/clerk] User created and welcome event emitted", {
          userId: newUserData.userId,
        });
        break;
      }

      case "user.updated": {
        console.log("Stub: handle user.updated");
        // TODO: implement update logic (mirror patterns above and throw ValidationError/DatabaseError as needed)
        break;
      }

      case "user.deleted": {
        console.log("Stub: handle user.deleted");
        // TODO: implement delete logic (use NotFoundError if local user missing, etc.)
        break;
      }

      default: {
        console.log(`Unhandled event type: ${eventType}`);
        // Not an error, we just acknowledge
        break;
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    // Match listings style: convert to typed errors and bubble to centralized error middleware
    if (err instanceof ValidationError || err instanceof DatabaseError) {
      return next(err);
    }

    // If verifyWebhook failed or anything else unexpected:
    console.error("❌ Clerk webhook handler error:", err);
    return next(new ValidationError("Invalid webhook", err));
  }
};

/**
 * Handle Finix webhook events
 * POST /api/v1/webhooks/finix
 *
 * Flow:
 * 1. Verify Basic Auth and HMAC signature
 * 2. Check for duplicate events (idempotency)
 * 3. Persist raw webhook to FinixWebhookEvent collection
 * 4. Enqueue for async processing via Bull
 * 5. Return 200 OK immediately
 */
export const webhook_finix_post = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();

  // TEMPORARY: Log all incoming requests to debug webhook issues
  console.log(`🔥 [WEBHOOK_DEBUG] Incoming Finix webhook request:`, {
    method: req.method,
    url: req.url,
    headers: {
      "content-type": req.headers["content-type"],
      "finix-signature": req.headers["finix-signature"]
        ? "[PRESENT]"
        : "[MISSING]",
      authorization: req.headers["authorization"] ? "[PRESENT]" : "[MISSING]",
      "x-request-id": req.headers["x-request-id"],
    },
    bodyKeys: req.body ? Object.keys(req.body) : "no body",
    bodySize: req.body ? JSON.stringify(req.body).length : 0,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  try {
    // Step 1: Verify Basic Auth (legacy)
    verifyBasic(req as any);

    // Step 2: Verify HMAC signature (if secret configured)
    // Note: We need rawBody for signature verification
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const signature = req.headers["finix-signature"] as string | undefined;

    const isValidSignature = verifyFinixSignature(
      rawBody,
      signature,
      config.finixWebhookSecret
    );

    if (!isValidSignature) {
      webhookLogger.error("❌ Invalid Finix webhook signature", {
        eventId: req.headers["finix-signature"],
        requestId: req.headers["x-request-id"],
        ip: req.ip,
      });
      res.status(401).json({
        success: false,
        message: "Invalid webhook signature",
      });
      return;
    }

    // Step 3: Handle ping/health check
    if (!req.body || Object.keys(req.body).length === 0) {
      webhookLogger.info("🏓 Finix webhook ping received", {
        requestId: req.headers["x-request-id"],
        ip: req.ip,
      });
      res.status(200).json({ ok: true, ping: true });
      return;
    }

    // Step 4: Validate and parse event
    const evt = FinixEventSchema.parse(req.body);
    const { entity, type, id } = evt;
    const eventId = id || `${entity}.${type}.${Date.now()}`;
    const eventType = `${entity}.${type}`;

    logWebhookEvent(eventType, eventId, {
      entity,
      type,
      requestId: req.headers["x-request-id"],
      ip: req.ip,
    });

    // Step 5: Idempotency check using FinixWebhookEvent
    const existingEvent = await FinixWebhookEvent.findOne({ eventId });
    if (existingEvent) {
      if (existingEvent.status === "processed") {
        webhookLogger.info(
          `⏭️ Finix webhook ${eventId} already processed, skipping`,
          {
            eventId,
            status: existingEvent.status,
            requestId: req.headers["x-request-id"],
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
        `🔄 Finix webhook ${eventId} exists with status: ${existingEvent.status}`,
        {
          eventId,
          status: existingEvent.status,
          attemptCount: existingEvent.attemptCount,
          requestId: req.headers["x-request-id"],
        }
      );
    }

    // Step 6: Persist raw webhook event for traceability (Finix-specific)
    if (!existingEvent) {
      await FinixWebhookEvent.create({
        eventId,
        eventType,
        payload: req.body,
        headers: req.headers as Record<string, string>,
        status: "pending",
        receivedAt: new Date(),
        attemptCount: 0,
      });
    }

    // Step 7: Also save to WebhookEvent for backward compatibility and capture its id
    const webhookEventDoc = await WebhookEvent.findOneAndUpdate(
      { eventId },
      {
        eventId,
        provider: "finix",
        type: eventType,
        payload: evt,
        status: "received",
        data: {},
      },
      { upsert: true, new: true }
    );

    // Step 8: Enqueue job for async processing
    // NOTE: pass the WebhookEvent._id (string) so the worker can update the WebhookEvent record
    const job = await webhookQueue.add({
      webhookEventId: (webhookEventDoc!._id as any).toString(),
      eventId,
      provider: "finix",
      // Pass the short type (e.g. 'created'|'updated') so the processor's
      // logic (which checks type === 'updated' etc.) works as intended.
      type: type || "unknown", // Provide fallback for optional type field
      payload: evt,
    });

    const processingTime = Date.now() - startTime;
    console.log(
      `✅ Enqueued Finix webhook ${eventId} as job ${job.id} (${processingTime}ms)`
    );

    // Step 9: Return 200 OK immediately (<200ms target)
    res.status(200).json({
      success: true,
      message: "Webhook received and enqueued",
      eventId,
      jobId: job.id,
      processingTime,
    });
  } catch (err: any) {
    const processingTime = Date.now() - startTime;
    console.error(
      `❌ Finix webhook handler error (${processingTime}ms):`,
      err.message || err
    );

    // Log security-related errors
    if (err.isAuth) {
      console.error("🚨 Authentication failed:", err.message);
    }

    if (err instanceof ValidationError || err instanceof DatabaseError) {
      return next(err);
    }

    return next(new ValidationError("Invalid Finix webhook", err));
  }
};
