/**
 * Offer Expiry Job Processor
 * 
 * Periodically checks for expired offers across both platforms.
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
      // 1. Process Marketplace offers
      const marketplaceExpired = await offerService.getExpiredOffers('marketplace');
      for (const channel of marketplaceExpired) {
        await offerService.expireOffer((channel as any)._id.toString(), 'marketplace');
      }

      // 2. Process Networks offers
      const networksExpired = await offerService.getExpiredOffers('networks');
      for (const channel of networksExpired) {
        await offerService.expireOffer((channel as any)._id.toString(), 'networks');
      }

      logger.info('✅ [Worker] Offer expiry check completed', {
        marketplaceCount: marketplaceExpired.length,
        networksCount: networksExpired.length
      });

      return {
        marketplace: marketplaceExpired.length,
        networks: networksExpired.length
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
