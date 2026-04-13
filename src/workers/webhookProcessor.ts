/**
 * Webhook Processor Worker
 *
 * Background worker that processes webhooks from the Bull queue.
 * Extracts processing logic from webhook handlers to enable async processing.
 */

import { Job } from "bull";
import { WebhookJobData, webhookQueue } from "../queues/webhookQueue";
import { WebhookEvent } from "../models/WebhookEvent";
import { FinixWebhookEvent } from "../models/FinixWebhookEvent";
import { GetstreamWebhookEvent } from "../models/GetstreamWebhookEvent";
import logger from "../utils/logger";
import { User } from "../models/User";
import { webhookLogger } from "../utils/logger";
import { processFinixWebhook } from "../marketplace/workers/MarketplaceWebhookProcessor";
import { events } from "../utils/events";

/**
 * Process a webhook job
 *
 * Called by Bull worker for each enqueued webhook.
 * Updates WebhookEvent and FinixWebhookEvent status based on processing result.
 *
 * @param job - Bull job containing webhook data
 * @returns Processing result message
 * @throws Error if processing fails (Bull will retry based on config)
 */
async function processWebhookJob(job: Job<WebhookJobData>): Promise<string> {
  const { webhookEventId, eventId, provider, type, payload } = job.data;

  webhookLogger.info(`🔄 Processing ${provider} webhook: ${type}`, {
    eventId,
    provider,
    type,
    jobId: job.id,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Update status to processing in both models
    const webhookEvent = await WebhookEvent.findById(webhookEventId);
    if (!webhookEvent) {
      webhookLogger.warn(`⚠️ WebhookEvent ${webhookEventId} not found`, {
        eventId,
        webhookEventId,
      });
    } else {
      webhookEvent.status = "processing";
      webhookEvent.data.attemptNumber = job.attemptsMade + 1;
      await webhookEvent.save();
    }

    // Update provider-specific event status
    if (provider === "finix") {
      const finixEvent = await FinixWebhookEvent.findOne({ eventId });
      if (finixEvent) {
        finixEvent.status = "processing";
        finixEvent.attemptCount = job.attemptsMade + 1;
        await finixEvent.save();
      }
    } else if (provider === "getstream") {
      const getstreamEvent = await GetstreamWebhookEvent.findOne({ eventId });
      if (getstreamEvent) {
        getstreamEvent.status = "processing";
        getstreamEvent.attemptCount = job.attemptsMade + 1;
        await getstreamEvent.save();
      }
    }

    // Dispatch by provider
    let result: string;
    if (provider === "finix") {
      result = await processFinixWebhook(type, payload, eventId);
    } else if (provider === "clerk") {
      result = await processClerkWebhook(type, payload);
    } else if (provider === "getstream") {
      result = await processGetstreamWebhook(type, payload, eventId);
    } else {
      throw new Error(`Unknown webhook provider: ${provider}`);
    }

    // Mark as processed in both models
    if (webhookEvent) {
      webhookEvent.status = "processed";
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();
    }

    if (provider === "finix") {
      const finixEvent = await FinixWebhookEvent.findOne({ eventId });
      if (finixEvent) {
        finixEvent.status = "processed";
        finixEvent.processedAt = new Date();
        await finixEvent.save();
      }
    } else if (provider === "getstream") {
      const getstreamEvent = await GetstreamWebhookEvent.findOne({ eventId });
      if (getstreamEvent) {
        getstreamEvent.status = "processed";
        getstreamEvent.processedAt = new Date();
        await getstreamEvent.save();
      }
    }

    webhookLogger.info(`✅ Completed ${provider} webhook: ${type}`, {
      result,
      eventId,
      jobId: job.id,
    });
    return result;
  } catch (error) {
    // Update both models with error
    const webhookEvent = await WebhookEvent.findById(webhookEventId);
    if (webhookEvent) {
      webhookEvent.status = "failed";
      webhookEvent.error =
        error instanceof Error ? error.message : String(error);
      await webhookEvent.save();
    }

    if (provider === "finix") {
      const finixEvent = await FinixWebhookEvent.findOne({ eventId });
      if (finixEvent) {
        finixEvent.status = "failed";
        finixEvent.error =
          error instanceof Error ? error.message : String(error);
        finixEvent.attemptCount = job.attemptsMade + 1;
        await finixEvent.save();
      }
    } else if (provider === "getstream") {
      const getstreamEvent = await GetstreamWebhookEvent.findOne({ eventId });
      if (getstreamEvent) {
        getstreamEvent.status = "failed";
        getstreamEvent.error =
          error instanceof Error ? error.message : String(error);
        getstreamEvent.attemptCount = job.attemptsMade + 1;
        await getstreamEvent.save();
      }
    }

    webhookLogger.error(`❌ Failed ${provider} webhook: ${type}`, {
      error: error instanceof Error ? error.message : String(error),
      eventId,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
    });
    throw error; // Re-throw to trigger Bull retry
  }
}

/**
 * Process Clerk webhook events
 *
 * Handles user lifecycle events (created, updated, deleted).
 * Note: Clerk webhooks are already processed synchronously in webhook handler
 * because they create critical user records. This is here for consistency.
 */
async function processClerkWebhook(
  type: string,
  _payload: any,
): Promise<string> {
  webhookLogger.info(`Processing Clerk webhook: ${type}`);

  // Clerk webhook processing logic would go here
  // Currently handled synchronously in webhook_clerk_post
  // This is a placeholder for future async processing if needed

  return `Clerk ${type} processed`;
}

/**
 * Process GetStream webhook events
 *
 * Handles chat events from GetStream Cloud:
 * - message.new - Store message in MongoDB
 * - message.updated - Update message in MongoDB
 * - message.deleted - Mark message as deleted
 * - message.read - Track read receipts
 * - channel.created/updated - Track channel events
 * - reaction.new/deleted - Track reactions
 *
 * @param type - Event type (e.g., "message.new")
 * @param payload - Webhook payload from GetStream
 * @param eventId - Unique event ID for logging
 */
async function processGetstreamWebhook(
  type: string,
  payload: any,
  eventId: string,
): Promise<string> {
  const { message, channel_id, channel_type, user } = payload;

  logger.info(`📥 Processing GetStream webhook: ${type}`, {
    eventId,
    type,
    channelId: channel_id,
    channelType: channel_type,
    userId: user?.id,
    messageId: message?.id,
  });

  let getstreamHandlerResult = "";

  switch (type) {
    case "message.new":
      getstreamHandlerResult = await handleGetstreamMessageNew(
        payload,
        eventId,
      );
      break;

    case "message.updated":
      getstreamHandlerResult = await handleGetstreamMessageUpdated(
        payload,
        eventId,
      );
      break;

    case "message.deleted":
      getstreamHandlerResult = await handleGetstreamMessageDeleted(
        payload,
        eventId,
      );
      break;

    case "message.read":
      getstreamHandlerResult = await handleGetstreamMessageRead(
        payload,
        eventId,
      );
      break;

    case "channel.created":
      getstreamHandlerResult = await handleGetstreamChannelEvent(
        payload,
        eventId,
        "created",
      );
      break;

    case "channel.updated":
      getstreamHandlerResult = await handleGetstreamChannelEvent(
        payload,
        eventId,
        "updated",
      );
      break;

    case "reaction.new":
      getstreamHandlerResult = await handleGetstreamReactionEvent(
        payload,
        eventId,
        "new",
      );
      break;

    case "reaction.deleted":
      getstreamHandlerResult = await handleGetstreamReactionEvent(
        payload,
        eventId,
        "deleted",
      );
      break;

    default:
      logger.info(`Unhandled GetStream event: ${type}`, { eventId });
      getstreamHandlerResult = `Unhandled GetStream event: ${type}`;
  }

  await runNetworksDomainHandler(
    type,
    payload,
    eventId,
    channel_id,
    channel_type,
  );

  // ✅ Return the global handler result
  return getstreamHandlerResult;
}

/**
 * Execute Networks-specific domain handlers
 * These run AFTER global handlers and perform business logic specific to Networks
 *
 * Idempotent: Safe to call multiple times for same event
 * Non-blocking: Failures don't cause webhook retry
 */
async function runNetworksDomainHandler(
  type: string,
  payload: any,
  eventId: string,
  channel_id?: string,
  channel_type?: string,
): Promise<void> {
  const cid = payload.cid || `${channel_type}:${channel_id}`;
  const isNetworksEvent = cid?.includes("networks");

  if (!isNetworksEvent) {
    return; // Not a Networks event, skip domain handlers
  }

  try {
    // Dynamically import Networks handlers
    const {
      onNetworkChatMessageNew,
      onNetworkChatMessageRead,
      onNetworkChatMessageUpdated,
      onNetworkChatMessageDeleted,
      onNetworkChatMemberAdded,
      onNetworkChatMemberUpdated,
      onNetworkChatChannelCreated,
      onNetworkChatChannelUpdated,
      onNetworkChatReactionNew,
      onNetworkChatReactionDeleted,
    } = require("../networks/events") as any;

    // Route to Networks handlers
    switch (type) {
      case "message.new":
        await onNetworkChatMessageNew(payload);
        break;
      case "message.read":
        await onNetworkChatMessageRead(payload);
        break;
      case "message.updated":
        await onNetworkChatMessageUpdated(payload);
        break;
      case "message.deleted":
        await onNetworkChatMessageDeleted(payload);
        break;
      case "member.added":
        await onNetworkChatMemberAdded(payload);
        break;
      case "member.updated":
        await onNetworkChatMemberUpdated(payload);
        break;
      case "channel.created":
        await onNetworkChatChannelCreated(payload);
        break;
      case "channel.updated":
        await onNetworkChatChannelUpdated(payload);
        break;
      case "reaction.new":
        await onNetworkChatReactionNew(payload);
        break;
      case "reaction.deleted":
        await onNetworkChatReactionDeleted(payload);
        break;
      default:
        // No Networks-specific handler for this event
        break;
    }

    logger.info(`✅ Networks domain handler executed for ${type}`, {
      eventId,
      type,
      cid,
    });
  } catch (networksError) {
    logger.error("Networks domain handler failed - not retrying", {
      error: networksError,
      type,
      eventId,
      cid: payload.cid,
    });
    // Don't re-throw: global handlers already succeeded
    // Networks failures should not cause webhook retry
  }
}

/**
 * Handle message.new event from GetStream
 * Stores the message in MongoDB for analytics, search, and backup
 */
async function handleGetstreamMessageNew(
  event: any,
  eventId: string,
): Promise<string> {
  const { message, channel_id } = event;

  try {
    // Find sender by GetStream user ID (which is our MongoDB user._id)
    const sender = await User.findById(message.user?.id);
    const listingId = event.channel?.listing_id || null;

    // ✅ UPDATE STATS (Business Logic remains)
    // Track activity for analytics
    if (sender) {
      await User.findByIdAndUpdate(sender._id, {
        $set: { last_activity: new Date() },
        $inc: { message_count: 1 },
      });
    }

    // Update listing engagement if applicable via event (Decoupled from Marketplace module)
    if (listingId) {
      events.emit("getstream:message.new", { listingId });
    }

    logger.debug("GetStream message.new processed (stats updated)", {
      streamMessageId: message.id,
      channelId: channel_id,
      eventId,
    });

    return `Processed stats for message ${message.id} for channel ${channel_id}`;
  } catch (error) {
    logger.error("Failed to handle message.new", {
      error: error instanceof Error ? error.message : String(error),
      messageId: message?.id,
      eventId,
    });
    throw error;
  }
}

/**
 * Handle message.updated event from GetStream
 */
async function handleGetstreamMessageUpdated(
  event: any,
  eventId: string,
): Promise<string> {
  const { message } = event;

  // Skipped: MongoDB no longer stores messages
  logger.debug("GetStream message.updated received (skipped MongoDB sync)", {
    streamMessageId: message.id,
    eventId,
  });

  return `Skipped MongoDB update for message ${message.id}`;
}

/**
 * Handle message.deleted event from GetStream
 */
async function handleGetstreamMessageDeleted(
  event: any,
  eventId: string,
): Promise<string> {
  const { message } = event;

  // Skipped: MongoDB no longer stores messages
  logger.debug("GetStream message.deleted received (skipped MongoDB sync)", {
    streamMessageId: message.id,
    eventId,
  });

  return `Skipped MongoDB deletion for message ${message.id}`;
}

/**
 * Handle message.read event from GetStream
 * Tracks read receipts for analytics
 */
async function handleGetstreamMessageRead(
  event: any,
  eventId: string,
): Promise<string> {
  const { user, channel_id } = event;

  logger.info("Message read event received", {
    userId: user?.id,
    channelId: channel_id,
    eventId,
  });

  // Track read receipts if needed for analytics
  // This can be expanded to store read receipts in a separate collection

  return `Read receipt processed for user ${user?.id} in channel ${channel_id}`;
}

/**
 * Handle channel.created/updated events from GetStream
 */
async function handleGetstreamChannelEvent(
  event: any,
  eventId: string,
  action: "created" | "updated",
): Promise<string> {
  const { channel_id, channel_type } = event;

  logger.info(`Channel ${action}`, {
    channelId: channel_id,
    channelType: channel_type,
    eventId,
  });

  // Track channel events for analytics if needed
  return `Channel ${channel_id} ${action}`;
}

/**
 * Handle reaction.new/deleted events from GetStream
 */
async function handleGetstreamReactionEvent(
  event: any,
  eventId: string,
  action: "new" | "deleted",
): Promise<string> {
  const { reaction, message } = event;

  // Skipped: MongoDB no longer stores messages or reactions
  logger.debug(`GetStream reaction.${action} received (skipped MongoDB sync)`, {
    reactionType: reaction?.type,
    messageId: message?.id,
    eventId,
  });

  return `Skipped MongoDB sync for reaction ${action} on message ${message?.id}`;
}

/**
 * Start the webhook processor worker
 *
 * Registers the job processor with Bull and starts processing jobs.
 * Should be called once during application startup.
 */
export function startWebhookWorker(): void {
  console.log("🚀 [Worker] Starting webhook processor worker...");

  webhookQueue.process(async (job: Job<WebhookJobData>) => {
    return await processWebhookJob(job);
  });

  console.log(" [Worker] Webhook processor worker started");
}

/**
 * Export for testing
 */
export {
  processWebhookJob,
  processFinixWebhook,
  processClerkWebhook,
  processGetstreamWebhook,
};
