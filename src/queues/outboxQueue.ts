/**
 * Outbox Queue Configuration
 *
 * Sets up Bull queue for the outbox publisher — polls EventOutbox
 * for unpublished events and emits them via TypedEventEmitter.
 */

import Queue from "bull";
import { config } from "../config";

export interface OutboxJobData {
  batchSize?: number;
}

export const outboxQueue = new Queue<OutboxJobData>(
  "outbox-publisher",
  config.redisUrl,
  {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  }
);

export async function closeOutboxQueue(): Promise<void> {
  await outboxQueue.close();
}

export default outboxQueue;
