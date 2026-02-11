/**
 * Outbox Publisher Worker
 *
 * Bull repeatable job that polls the EventOutbox collection for unpublished
 * events and re-emits them via the TypedEventEmitter. This bridges the
 * transactional outbox pattern with the in-process event system.
 *
 * Schedule: Every 5 seconds (configurable)
 * Batch size: 50 events per run
 *
 * Flow:
 *   1. Poll EventOutbox.findUnpublished(batchSize)
 *   2. For each event, emit to TypedEventEmitter
 *   3. Mark as published on success, mark as failed on error
 *   4. Cleanup old published events weekly
 */

import { Job } from "bull";
import { outboxQueue, OutboxJobData } from "../queues/outboxQueue";
import { EventOutbox, IEventOutbox } from "../models/EventOutbox";
import { events } from "../utils/events";
import logger from "../utils/logger";

const DEFAULT_BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

/**
 * Map outbox event types to the typed event emitter events.
 * This bridges the outbox aggregate events to the in-process event system.
 */
function emitOutboxEvent(event: IEventOutbox): void {
  const { event_type, payload } = event;

  switch (event_type) {
    // Offer events
    case "OFFER_CREATED":
      events.emit("offer:sent", {
        offerId: payload.offerId,
        channelId: payload.channelId,
        senderId: payload.buyerId,
        receiverId: payload.sellerId,
        amount: payload.amount,
        listingId: payload.listingId,
        platform: payload.platform,
      });
      break;

    case "OFFER_COUNTERED":
      events.emit("offer:countered", {
        offerId: payload.offerId,
        channelId: payload.channelId,
        senderId: payload.counterById,
        receiverId: payload.receiverId || "",
        amount: payload.amount,
        previousAmount: payload.previousAmount || 0,
        platform: payload.platform || "marketplace",
      });
      break;

    case "OFFER_ACCEPTED":
      events.emit("offer:accepted", {
        offerId: payload.offerId,
        channelId: payload.channelId,
        buyerId: payload.buyerId,
        sellerId: payload.sellerId,
        amount: payload.amount,
        orderId: payload.orderId || "",
        platform: payload.platform,
      });
      break;

    case "OFFER_DECLINED":
      events.emit("offer:rejected", {
        offerId: payload.offerId,
        channelId: payload.channelId || "",
        buyerId: payload.buyerId,
        sellerId: payload.sellerId,
        amount: payload.amount || 0,
        platform: payload.platform || "marketplace",
      });
      break;

    case "OFFER_EXPIRED":
      events.emit("offer:expired", {
        offerId: payload.offerId,
        channelId: payload.channelId || "",
        buyerId: payload.buyerId,
        sellerId: payload.sellerId,
        amount: payload.amount || 0,
      });
      break;

    // Vouch events — emit as notification trigger
    case "VOUCH_ADDED":
      events.emit("notification:created", {
        notificationId: payload.vouchId || "",
        userId: payload.vouchForUserId || "",
        type: "vouch_added",
      });
      break;

    // Order events
    case "ORDER_CREATED":
      events.emit("order:created", {
        buyerId: payload.buyerId,
        sellerId: payload.sellerId,
        orderId: payload.orderId,
        amount: payload.amount,
        platform: "marketplace",
      });
      break;

    case "ORDER_SHIPPED":
      events.emit("order:shipped", {
        buyerId: payload.buyerId,
        orderId: payload.orderId,
        trackingNumber: payload.trackingNumber,
      });
      break;

    case "ORDER_DELIVERED":
      events.emit("order:delivered", {
        buyerId: payload.buyerId,
        orderId: payload.orderId,
      });
      break;

    // Vouch events
    case "VOUCH_ADDED":
      events.emit("vouch:added", {
        vouchId: payload.vouchId || "",
        voucherId: payload.voucherId || "",
        vouchedUserId: payload.vouchForUserId || "",
        referenceCheckId: payload.referenceCheckId || "",
        voucherName: payload.voucherName,
      });
      break;

    // Trust Case events
    case "TRUST_CASE_CREATED":
      events.emit("trustCase:created", {
        caseId: payload.caseId,
        caseNumber: payload.caseNumber,
        reportedUserId: payload.reportedUserId,
        reporterUserId: payload.reporterUserId || "",
        category: payload.category,
        priority: payload.priority,
      });
      break;

    case "TRUST_CASE_ESCALATED":
      events.emit("trustCase:escalated", {
        caseId: payload.caseId,
        caseNumber: payload.caseNumber,
        escalatedTo: payload.escalatedTo,
        reason: payload.reason,
      });
      break;

    case "TRUST_CASE_RESOLVED":
      events.emit("trustCase:resolved", {
        caseId: payload.caseId,
        caseNumber: payload.caseNumber,
        resolvedBy: payload.resolvedBy,
        resolution: payload.resolution,
      });
      break;

    case "TRUST_CASE_CLOSED":
      events.emit("trustCase:closed", {
        caseId: payload.caseId,
        caseNumber: payload.caseNumber,
        closedBy: payload.closedBy,
      });
      break;

    case "USER_SUSPENDED":
      events.emit("user:suspended", {
        userId: payload.userId,
        suspendedById: payload.suspendedById,
        caseId: payload.caseId,
        reason: payload.reason,
        durationDays: payload.durationDays,
      });
      break;

    default:
      logger.debug("[OutboxPublisher] Unhandled event type, skipping", {
        eventType: event_type,
        aggregateId: event.aggregate_id?.toString(),
      });
  }
}

/**
 * Process a batch of unpublished outbox events.
 */
async function processOutboxBatch(batchSize: number): Promise<{
  processed: number;
  failed: number;
}> {
  const unpublished = await EventOutbox.findUnpublished(batchSize);

  if (unpublished.length === 0) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const event of unpublished) {
    try {
      // Skip events that have exceeded max attempts
      if (event.attempts >= MAX_ATTEMPTS) {
        logger.warn("[OutboxPublisher] Event exceeded max attempts, skipping", {
          eventId: event._id?.toString(),
          eventType: event.event_type,
          attempts: event.attempts,
        });
        continue;
      }

      // Emit the event
      emitOutboxEvent(event as any);

      // Mark as published
      await EventOutbox.markAsPublished(event._id!);
      processed++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await EventOutbox.markAsFailed(event._id!, errorMessage);
      failed++;

      logger.error("[OutboxPublisher] Failed to process event", {
        eventId: event._id?.toString(),
        eventType: event.event_type,
        error: errorMessage,
      });
    }
  }

  return { processed, failed };
}

/**
 * Start the outbox publisher worker.
 * Schedules a recurring job every 5 seconds.
 */
export function startOutboxPublisher(): void {
  logger.info("🚀 [Worker] Starting outbox publisher worker...");

  // Process the queue
  outboxQueue.process(async (job: Job<OutboxJobData>) => {
    const batchSize = job.data?.batchSize || DEFAULT_BATCH_SIZE;

    const result = await processOutboxBatch(batchSize);

    if (result.processed > 0 || result.failed > 0) {
      logger.info("[OutboxPublisher] Batch completed", {
        processed: result.processed,
        failed: result.failed,
      });
    }

    return result;
  });

  // Schedule the recurring job every 5 seconds
  outboxQueue.add(
    {},
    {
      repeat: {
        every: 5000, // Every 5 seconds
      },
      jobId: "outbox-publisher-recurring",
    }
  );

  // Schedule weekly cleanup of old published events (Sunday at 3 AM)
  outboxQueue.add(
    { batchSize: 0 }, // Special marker for cleanup job
    {
      repeat: {
        cron: "0 3 * * 0", // Sunday 3 AM
      },
      jobId: "outbox-cleanup-weekly",
    }
  );

  // Add cleanup processor
  outboxQueue.on("completed", async (job) => {
    if (job.data?.batchSize === 0 && job.opts?.jobId === "outbox-cleanup-weekly") {
      try {
        const deletedCount = await EventOutbox.cleanupOldEvents(7);
        logger.info("[OutboxPublisher] Weekly cleanup completed", {
          deletedCount,
        });
      } catch (error) {
        logger.error("[OutboxPublisher] Weekly cleanup failed", { error });
      }
    }
  });

  logger.info("📅 [Worker] Outbox publisher scheduled (every 5 seconds)");
}
