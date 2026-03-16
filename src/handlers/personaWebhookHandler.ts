import { Request, Response } from "express";
import { verifyPersonaWebhookSignature } from "../utils/persona";
import { User } from "../models/User";
import logger from "../utils/logger";

export async function handlePersonaWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    // Step 1 — Verify signature
    const signature = req.headers["persona-signature"] as string;
    const rawBody = (req as any).rawBody; // set by express.json verify callback

    if (!verifyPersonaWebhookSignature(rawBody, signature)) {
      logger.warn("[Persona] Invalid webhook signature");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const event = req.body;
    const eventName = event?.data?.attributes?.name;

    logger.info(`[Persona] Webhook received: ${eventName}`);

    // Step 2 — Handle only relevant events
    switch (eventName) {
      case "inquiry.approved":
        await handleInquiryApproved(event);
        break;
      case "inquiry.failed":
      case "inquiry.declined":
        await handleInquiryFailed(event);
        break;
      case "inquiry.expired":
        await handleInquiryExpired(event);
        break;
      default:
        logger.info(`[Persona] Unhandled event: ${eventName}`);
    }

    // Always return 200 quickly — Persona retries if you don't
    res.status(200).json({ received: true });
  } catch (err) {
    logger.error("[Persona] Webhook error:", err);
    // Still return 200 to prevent Persona from retrying endlessly
    res.status(200).json({ received: true });
  }
}

// ─── Event handlers ────────────────────────────────────────────────────────

async function handleInquiryApproved(event: any): Promise<void> {
  const inquiry = event.data.attributes;
  const externalId = inquiry.reference_id; // mapped from clerkId

  // Validate reference_id is present
  if (!externalId || externalId.trim().length === 0) {
    logger.warn("[Persona] Missing or empty reference_id in approved inquiry", {
      inquiryId: event.data.id,
    });
    return;
  }

  // Idempotency check: don't process if already verified for this inquiry
  const existingUser = await User.findOne({
    external_id: externalId,
    personaInquiryId: event.data.id,
    identityVerified: true,
  }).select("_id");

  if (existingUser) {
    logger.info(
      `[Persona] Inquiry ${event.data.id} already processed for user ${externalId}. Skipping.`,
    );
    return;
  }

  // Mark user as verified in DB
  const user = await User.findOneAndUpdate(
    { external_id: externalId },
    {
      identityVerified: true,
      identityVerifiedAt: new Date(),
      personaInquiryId: event.data.id,
      personaStatus: "approved",
    },
    { new: true },
  );

  if (!user) {
    logger.warn(`[Persona] User not found for external_id: ${externalId}`);
    return;
  }

  // Send in-app notification when identity is verified
  try {
    // TODO: Use platform-specific notification service
    /*    await notificationService.create({
      userId: user._id.toString(),
      type: "IDENTITY_VERIFIED",
      title: "Identity Verified",
      body: "Your identity has been successfully verified.",
      data: { personaInquiryId: event.data.id },
      sendPush: true,
    }); */
  } catch (notifErr) {
    logger.error(
      "[Persona] Failed to create identity verification notification",
      { error: notifErr },
    );
  }

  logger.info(`[Persona] User ${externalId} identity verified`);
}

async function handleInquiryFailed(event: any): Promise<void> {
  const inquiry = event.data.attributes;
  const externalId = inquiry.reference_id;

  if (!externalId || externalId.trim().length === 0) {
    logger.warn("[Persona] Invalid reference_id in failed inquiry", {
      inquiryId: event.data.id,
    });
    return;
  }

  // Idempotency check
  const existingUser = await User.findOne({
    external_id: externalId,
    personaInquiryId: event.data.id,
    personaStatus: "failed",
  }).select("_id");

  if (existingUser) {
    logger.info(
      `[Persona] Failed inquiry ${event.data.id} already processed for user ${externalId}. Skipping.`,
    );
    return;
  }

  const user = await User.findOneAndUpdate(
    { external_id: externalId },
    {
      identityVerified: false,
      personaInquiryId: event.data.id,
      personaStatus: "failed",
    },
    { new: true },
  );

  if (user) {
    // Send in-app notification when identity verification fails
    try {
      // TODO: Use platform-specific notification service
      /*      await notificationService.create({
        userId: user._id.toString(),
        type: "IDENTITY_VERIFICATION_FAILED",
        title: "Verification Failed",
        body: "Your identity verification was unsuccessful. Please try again.",
        data: { personaInquiryId: event.data.id },
        sendPush: true,
      }); */
    } catch (notifErr) {
      logger.error(
        "[Persona] Failed to create identity verification failure notification",
        { error: notifErr },
      );
    }
  }

  logger.info(`[Persona] User ${externalId} verification failed`);
}

async function handleInquiryExpired(event: any): Promise<void> {
  const externalId = event.data.attributes.reference_id;
  if (!externalId) return;

  await User.findOneAndUpdate(
    { external_id: externalId },
    { personaStatus: "expired" },
  );

  logger.info(`[Persona] Inquiry expired for external_id: ${externalId}`);
}
