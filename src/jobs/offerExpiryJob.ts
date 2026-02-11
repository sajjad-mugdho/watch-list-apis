/**
 * Offer Expiry Job
 * 
 * Background job that runs periodically to expire stale offers.
 * Uses simple setInterval for simplicity. Can be replaced with Bull queues.
 * 
 * Offers expire after 48 hours automatically.
 */

import { offerService } from '../services';
import logger from '../utils/logger';

// Run every 15 minutes
const INTERVAL_MS = 15 * 60 * 1000;

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Process expired offers for both platforms
 */
async function processExpiredOffers(): Promise<void> {
  if (isRunning) {
    logger.debug('Offer expiry job already running, skipping');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    logger.info('Starting offer expiry job');

    // Process all expired offers (no longer separated by platform)
    const expiredOffers = await offerService.getExpiredOffers();
    let expiredCount = 0;
    
    for (const offer of expiredOffers as any[]) {
      try {
        await offerService.expireOffer(offer._id.toString());
        expiredCount++;
      } catch (error) {
        logger.error('Failed to expire offer', {
          offerId: offer._id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Offer expiry job completed', {
      expiredCount,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('Offer expiry job failed', {
      error: error instanceof Error ? error.message : error,
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Start the offer expiry job scheduler
 */
export function startOfferExpiryJob(): void {
  if (intervalId) {
    logger.warn('Offer expiry job already started');
    return;
  }

  logger.info('Starting offer expiry job scheduler', {
    intervalMs: INTERVAL_MS,
  });

  // Run immediately on startup
  processExpiredOffers();

  // Schedule periodic runs
  intervalId = setInterval(processExpiredOffers, INTERVAL_MS);
}

/**
 * Stop the offer expiry job scheduler
 */
export function stopOfferExpiryJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Offer expiry job scheduler stopped');
  }
}

/**
 * Run offer expiry job manually (for testing)
 */
export async function runOfferExpiryJobOnce(): Promise<void> {
  await processExpiredOffers();
}
