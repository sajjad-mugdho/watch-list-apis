/**
 * Webhook Queue Configuration
 *
 * Sets up Bull queue for async webhook processing with Redis backend.
 * Provides retry logic, exponential backoff, and job lifecycle management.
 */

import Queue from "bull";
import { config } from "../config";

/**
 * Webhook job data structure
 */
export interface WebhookJobData {
  webhookEventId: string; // MongoDB _id of WebhookEvent document
  eventId: string; // Finix event ID (for logging)
  provider: "finix" | "clerk" | "getstream";
  type: string; // e.g., 'onboarding_form.updated'
  payload: any; // Full webhook payload
  attemptNumber?: number; // Current retry attempt (1-indexed)
}

/**
 * Webhook processing queue
 *
 * Job lifecycle:
 * 1. Webhook handler receives request → verifies signature
 * 2. Creates WebhookEvent document with status='received'
 * 3. Enqueues job to this queue
 * 4. Returns 200 OK in <200ms
 * 5. Worker processes job asynchronously
 * 6. Updates WebhookEvent status to 'processed' or 'failed'
 */
export const webhookQueue = new Queue<WebhookJobData>(
  "webhook-processing",
  config.redisUrl,
  {
    defaultJobOptions: {
      attempts: 10, // ✅ Retry up to 10 times (handles out-of-order webhooks)
      backoff: {
        type: "exponential",
        delay: 2000, // Start with 2s delay, doubles each retry (2s, 4s, 8s, 16s, etc.)
      },
      removeOnComplete: 100, // Keep last 100 completed jobs for debugging
      removeOnFail: 500, // Keep last 500 failed jobs for analysis
      timeout: 30000, // 30s timeout per job
    },
    settings: {
      stalledInterval: 60000, // Check for stalled jobs every 60s
      maxStalledCount: 2, // Mark job as failed after 2 stalled checks
      lockDuration: 30000, // Hold job lock for 30s while processing
      lockRenewTime: 15000, // Renew lock every 15s if still processing
    },
  }
);

/**
 * Queue event handlers for monitoring
 */
webhookQueue.on("error", (error) => {
  console.error("❌ [Queue] Redis connection error:", error);
});

webhookQueue.on("waiting", (jobId) => {
  console.log(`⏳ [Queue] Job ${jobId} is waiting to be processed`);
});

webhookQueue.on("active", (job) => {
  console.log(
    `🔄 [Queue] Job ${job.id} started processing (attempt ${
      job.attemptsMade + 1
    }/${job.opts.attempts})`
  );
});

webhookQueue.on("completed", (job, result) => {
  console.log(`✅ [Queue] Job ${job.id} completed successfully:`, result);
});

webhookQueue.on("failed", (job, error) => {
  if (job) {
    console.error(
      `❌ [Queue] Job ${job.id} failed after ${job.attemptsMade} attempts:`,
      error.message
    );
    console.error(`   Event: ${job.data.type} (${job.data.eventId})`);
  } else {
    console.error("❌ [Queue] Job failed (job object is null):", error);
  }
});

webhookQueue.on("stalled", (job) => {
  console.warn(`⚠️ [Queue] Job ${job.id} has stalled and will be retried`);
});

/**
 * Graceful shutdown handler
 *
 * Call this when the application is shutting down to:
 * 1. Stop accepting new jobs
 * 2. Wait for active jobs to complete (with timeout)
 * 3. Close Redis connection
 */
export async function closeWebhookQueue(): Promise<void> {
  console.log("🛑 [Queue] Closing webhook queue...");

  try {
    await webhookQueue.close(); // Close gracefully
    console.log("✅ [Queue] Webhook queue closed successfully");
  } catch (error) {
    console.error("❌ [Queue] Error closing webhook queue:", error);
    throw error;
  }
}

/**
 * Health check: verify queue can communicate with Redis
 */
export async function checkWebhookQueueHealth(): Promise<{
  healthy: boolean;
  message: string;
}> {
  try {
    const jobCounts = await webhookQueue.getJobCounts();
    return {
      healthy: true,
      message: `Queue is healthy. Jobs: ${JSON.stringify(jobCounts)}`,
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get queue metrics for monitoring
 */
export async function getWebhookQueueMetrics() {
  const [jobCounts, waiting, active, completed, failed] = await Promise.all([
    webhookQueue.getJobCounts(),
    webhookQueue.getWaiting(),
    webhookQueue.getActive(),
    webhookQueue.getCompleted(),
    webhookQueue.getFailed(),
  ]);

  return {
    counts: jobCounts,
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    paused: await webhookQueue.isPaused(),
  };
}

export default webhookQueue;
