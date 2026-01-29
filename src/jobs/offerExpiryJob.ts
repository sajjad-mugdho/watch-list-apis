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

    // Process marketplace offers
    const marketplaceExpired = await offerService.getExpiredOffers('marketplace');
    let marketplaceCount = 0;
    
    for (const channel of marketplaceExpired as any[]) {
      try {
        await offerService.expireOffer(channel._id.toString(), 'marketplace');
        marketplaceCount++;
      } catch (error) {
        logger.error('Failed to expire marketplace offer', {
          channelId: channel._id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    // Process networks offers
    const networksExpired = await offerService.getExpiredOffers('networks');
    let networksCount = 0;

    for (const channel of networksExpired as any[]) {
      try {
        await offerService.expireOffer(channel._id.toString(), 'networks');
        networksCount++;
      } catch (error) {
        logger.error('Failed to expire networks offer', {
          channelId: channel._id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Offer expiry job completed', {
      marketplaceExpired: marketplaceCount,
      networksExpired: networksCount,
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
