/**
 * Offer Expiry Queue Configuration
 * 
 * Sets up Bull queue for recurring offer expiry checks.
 */

import Queue from 'bull';
import { config } from '../config';

export interface OfferExpiryJobData {
  // Recurring jobs don't necessarily need specific data, 
  // but we can pass config if needed.
  checkIntervalMinutes?: number;
}

/**
 * Offer Expiry Queue
 */
export const offerExpiryQueue = new Queue<OfferExpiryJobData>(
  'offer-expiry',
  config.redisUrl,
  {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  }
);

/**
 * Graceful shutdown
 */
export async function closeOfferExpiryQueue(): Promise<void> {
  await offerExpiryQueue.close();
}

export default offerExpiryQueue;
