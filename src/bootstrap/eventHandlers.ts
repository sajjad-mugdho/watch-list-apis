/**
 * Event Handler Registration
 * 
 * This file bootstraps all event listeners for the application.
 * It is called once during server startup.
 */

import { events } from '../utils/events';
import { notificationService } from '../services';
import { isoMatchingService } from '../services/ISOMatchingService';
import logger from '../utils/logger';

export function registerEventHandlers(): void {
  logger.info('Registering system event handlers...');
  
  // Ensure ISOMatchingService singleton is initialized (registers listing:published listener)
  // The import triggers constructor which calls initialize()
  void isoMatchingService;

  /**
   * Welcome Notification for New Users
   */
  events.on('user:registered', async ({ userId, firstName }) => {
    logger.info('Sending welcome notification', { userId });
    
    await notificationService.create({
      userId,
      type: 'welcome',
      title: `Welcome to Dialist${firstName ? `, ${firstName}` : ''}!`,
      body: 'Start exploring luxury watches from trusted collectors.',
      actionUrl: '/explore',
      sendPush: true,
    });
  });

  /**
   * Onboarding Complete Notification
   */
  events.on('user:onboarding_complete', async ({ userId }) => {
    await notificationService.create({
      userId,
      type: 'onboarding_complete',
      title: 'Profile Complete!',
      body: "You're all set. Start browsing or list your first watch.",
      actionUrl: '/marketplace',
      sendPush: true,
    });
  });

  /**
   * Channel Created Side Effects
   */
  events.on('channel:created', async ({ sellerId, channelId, platform, createdFrom }) => {
    logger.debug('Handling channel:created event', { channelId, sellerId });
    
    // Notify seller of new inquiry/offer
    const title = createdFrom === 'offer' ? 'New Offer Received' : 'New Inquiry';
    const body = createdFrom === 'offer' 
      ? 'Someone has sent you a new offer.' 
      : 'Someone is interested in your listing.';

    await notificationService.create({
      userId: sellerId,
      type: createdFrom === 'offer' ? 'offer_received' : 'new_message',
      title,
      body,
      data: { channelId, platform },
    });
  });

  /**
   * Offer Sent Side Effects
   */
  events.on('offer:sent', async ({ receiverId, channelId, platform, amount, listingId }) => {
    logger.debug('Handling offer:sent event', { channelId, receiverId });
    
    await notificationService.create({
      userId: receiverId,
      type: 'offer_received',
      title: 'New Offer Received',
      body: `You received an offer of $${amount}.`,
      data: { channelId, platform, listingId },
    });
  });

  /**
   * Offer Accepted Side Effects
   */
  events.on('offer:accepted', async ({ buyerId, orderId, platform, amount }) => {
    logger.debug('Handling offer:accepted event', { orderId, buyerId });
    
    await notificationService.create({
      userId: buyerId,
      type: 'offer_accepted',
      title: 'Offer Accepted!',
      body: `Your $${amount} offer was accepted.`,
      data: { orderId, platform },
    });
  });

  /**
   * Offer Countered Side Effects
   */
  events.on('offer:countered', async ({ receiverId, channelId, platform, amount, previousAmount }) => {
    logger.debug('Handling offer:countered event', { channelId, receiverId });
    
    await notificationService.create({
      userId: receiverId,
      type: 'counter_offer',
      title: 'Counter Offer Received',
      body: `Your $${previousAmount} offer received a counter of $${amount}.`,
      data: { channelId, platform },
    });
  });

  /**
   * Offer Rejected Side Effects
   */
  events.on('offer:rejected', async ({ buyerId, amount, platform, channelId }) => {
    logger.debug('Handling offer:rejected event', { channelId });
    
    // Notify the buyer that their offer was declined
    await notificationService.create({
      userId: buyerId,
      type: 'offer_rejected',
      title: 'Offer Declined',
      body: `Your $${amount} offer was declined.`,
      data: { channelId, platform },
    });
  });

  /**
   * Offer Expired Side Effects
   */
  events.on('offer:expired', async ({ buyerId, amount, channelId }) => {
    logger.debug('Handling offer:expired event', { channelId });
    
    // Notify the buyer that their offer has expired
    await notificationService.create({
      userId: buyerId,
      type: 'offer_expired',
      title: 'Offer Expired',
      body: `Your $${amount} offer has expired.`,
      data: { channelId },
    });
  });

  /**
   * Message Read Side Effects
   */
  events.on('message:read', async ({ channelId, userId, messageCount }) => {
    logger.debug('Handling message:read event', { channelId, userId, messageCount });
    // Potential logic: update user last_read index, clear app badges, etc.
  });

  /**
   * Listing Published Notification
   */
  events.on('listing:created', async ({ userId, listingId, title }) => {
    await notificationService.create({
      userId,
      type: 'listing_created',
      title: 'Listing Published!',
      body: `Your listing "${title}" is now live.`,
      data: { listingId },
      actionUrl: `/listings/${listingId}`,
    });
  });

  events.on('listing:favorited', async ({ sellerId, buyerName, listingId }) => {
    await notificationService.create({
      userId: sellerId,
      type: 'listing_favorited',
      title: 'Someone Favorited Your Watch',
      body: `${buyerName} saved your listing.`,
      data: { listingId },
      actionUrl: `/listings/${listingId}`,
    });
  });

  /**
   * Order Lifecycle Notifications
   */
  events.on('order:created', async ({ sellerId, orderId, amount }) => {
    // Notify seller
    await notificationService.create({
      userId: sellerId,
      type: 'order_created',
      title: 'New Order!',
      body: `You have a new $${amount} order.`,
      data: { orderId },
      actionUrl: `/orders/${orderId}`,
      sendPush: true,
    });
  });

  events.on('order:shipped', async ({ buyerId, orderId, trackingNumber }) => {
    await notificationService.create({
      userId: buyerId,
      type: 'order_shipped',
      title: 'Your Order Shipped!',
      body: trackingNumber ? `Tracking: ${trackingNumber}` : 'Check your order for details.',
      data: { orderId, trackingNumber },
      actionUrl: `/orders/${orderId}`,
      sendPush: true,
    });
  });

  events.on('order:delivered', async ({ buyerId, orderId }) => {
    await notificationService.create({
      userId: buyerId,
      type: 'order_delivered',
      title: 'Order Delivered!',
      body: 'Your watch has arrived. Please confirm receipt.',
      data: { orderId },
      actionUrl: `/orders/${orderId}/confirm`,
      sendPush: true,
    });

    // Gap Fill Phase 3: Trigger review reminder after delivery
    // Delayed notification prompting buyer to leave a review
    try {
      const { reviewService } = await import('../services/review/ReviewService');
      // Send reminder after a short delay (could be moved to a scheduled job)
      setTimeout(async () => {
        await reviewService.sendReviewReminder(orderId);
      }, 1000 * 60 * 60 * 24); // 24 hours after delivery
    } catch (err) {
      logger.warn('Failed to schedule review reminder', { orderId, err });
    }
  });

  /**
   * Social Notifications
   */
  events.on('user:followed', async ({ followedUserId, followerName }) => {
    await notificationService.create({
      userId: followedUserId,
      type: 'follow_received',
      title: 'New Follower!',
      body: `${followerName} started following you.`,
      sendPush: false, // Low priority
    });
  });

  /**
   * ISO Match Notifications
   */
  events.on('iso:matched', async ({ userId, isoId, matchedListingId }) => {
    await notificationService.create({
      userId,
      type: 'iso_match',
      title: 'ISO Match Found!',
      body: 'A listing matches your search criteria.',
      data: { isoId, matchedListingId },
      actionUrl: `/listings/${matchedListingId}`,
      sendPush: true,
    });
  });

  logger.info('Event handlers registered successfully.');
}
