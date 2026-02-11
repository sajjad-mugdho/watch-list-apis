/**
 * Offer Expiry Job Processor
 * 
 * Periodically checks for expired offers using the first-class Offer model.
 * Queries Offer.findExpiredOffers() and transitions each to EXPIRED state.
 * 48 hours is the default expiry time.
 */

import { Job } from 'bull';
import { offerExpiryQueue, OfferExpiryJobData } from '../queues/offerExpiryQueue';
import { offerService } from '../services';
import logger from '../utils/logger';

/**
 * Start the offer expiry worker
 */
export function startOfferExpiryWorker(): void {
  logger.info('🚀 [Worker] Starting offer expiry job processor...');

  // Process the queue
  offerExpiryQueue.process(async (_job: Job<OfferExpiryJobData>) => {
    logger.info('🕒 [Worker] Running scheduled offer expiry check...');
    
    try {
      // Query the Offer collection for expired offers (CREATED/COUNTERED with past expires_at)
      const expiredOffers = await offerService.getExpiredOffers();
      
      let expiredCount = 0;
      let failedCount = 0;

      for (const offer of expiredOffers) {
        try {
          await offerService.expireOffer(offer._id.toString());
          expiredCount++;
        } catch (error) {
          failedCount++;
          logger.error('❌ [Worker] Failed to expire individual offer:', {
            offerId: offer._id.toString(),
            error,
          });
        }
      }

      logger.info('✅ [Worker] Offer expiry check completed', {
        totalFound: expiredOffers.length,
        expired: expiredCount,
        failed: failedCount,
      });

      return {
        found: expiredOffers.length,
        expired: expiredCount,
        failed: failedCount,
      };
    } catch (error) {
      logger.error('❌ [Worker] Offer expiry check failed:', error);
      throw error;
    }
  });

  // Schedule the recurring job every 15 minutes
  offerExpiryQueue.add(
    {},
    {
      repeat: {
        cron: '*/15 * * * *', // Every 15 minutes
      },
      jobId: 'offer-expiry-recurring', // Unique ID to prevent duplicates
    }
  );

  logger.info('📅 [Worker] Offer expiry job scheduled for every 15 minutes');
}
