/**
 * Offer Expiry Job
 * 
 * Background job that runs periodically to expire stale offers.
 * Uses simple setInterval for simplicity. Can be replaced with Bull queues.
 * 
 * Offers expire after 48 hours automatically.
 */

import { marketplaceOfferService } from '../marketplace/services/MarketplaceOfferService';
import { networksOfferService } from '../networks/services/NetworksOfferService';
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

    let expiredCount = 0;
    
    // Process Marketplace Expired Offers
    try {
      const marketplaceExpiredOffers = await marketplaceOfferService.getExpiredOffers();
      
      for (const offer of marketplaceExpiredOffers as any[]) {
        try {
          await marketplaceOfferService.expireOffer(offer._id.toString());
          expiredCount++;
        } catch (error) {
          logger.error('Failed to expire marketplace offer', {
            offerId: offer._id,
            error: error instanceof Error ? error.message : error,
          });
        }
      }
    } catch (err) {
      logger.error('Failed to process marketplace offers in expiry job', {
        error: err instanceof Error ? err.message : err,
      });
    }

    // Process Networks Expired Offers
    try {
      const networksExpiredOffers = await networksOfferService.getExpiredOffers();
      
      for (const offer of networksExpiredOffers as any[]) {
        try {
          await networksOfferService.expireOffer(offer._id.toString());
          expiredCount++;
        } catch (error) {
          logger.error('Failed to expire networks offer', {
            offerId: offer._id,
            error: error instanceof Error ? error.message : error,
          });
        }
      }
    } catch (err) {
      logger.error('Failed to process networks offers in expiry job', {
        error: err instanceof Error ? err.message : err,
      });
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
