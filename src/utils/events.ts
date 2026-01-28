import { EventEmitter as NodeEventEmitter } from 'events';
import logger from './logger';

/**
 * Event Map defining all system events and their payloads
 */
export interface EventMap {
  'channel:created': { 
    channelId: string; 
    getstreamChannelId: string;
    buyerId: string; 
    sellerId: string; 
    listingId: string;
    platform: 'marketplace' | 'networks';
    createdFrom: 'inquiry' | 'offer' | 'order';
  };
  'message:sent': {
    messageId: string;
    channelId: string;
    senderId: string;
    text?: string;
    type: string;
    platform: 'marketplace' | 'networks';
  };
  'message:read': {
    channelId: string;
    userId: string;
    messageCount: number;
  };
  'offer:sent': { 
    offerId: string; 
    channelId: string; 
    senderId: string;
    receiverId: string;
    amount: number;
    listingId: string;
    platform: 'marketplace' | 'networks';
  };
  'offer:accepted': { 
    offerId: string; 
    channelId: string;
    buyerId: string;
    sellerId: string;
    amount: number;
    orderId: string;
    platform: 'marketplace' | 'networks';
  };
  'offer:rejected': {
    offerId: string;
    channelId: string;
    buyerId: string;
    sellerId: string;
    amount: number;
    platform: 'marketplace' | 'networks';
  };
  'offer:countered': {
    offerId: string;
    channelId: string;
    senderId: string;
    receiverId: string;
    amount: number;
    previousAmount: number;
    platform: 'marketplace' | 'networks';
  };
  'offer:expired': { 
    offerId: string; 
    channelId: string;
    buyerId: string;
    sellerId: string;
    amount: number;
  };
  'notification:created': {
    notificationId: string;
    userId: string;
    type: string;
  };
  'user:registered': {
    userId: string;
    email: string;
    firstName: string;
  };
  'user:onboarding_complete': {
    userId: string;
  };
  
  // Listing Events
  'listing:created': {
    userId: string;
    listingId: string;
    title: string;
  };
  'listing:favorited': {
    sellerId: string;
    buyerName: string;
    listingId: string;
  };

  // Order Lifecycle Events
  'order:created': {
    buyerId: string;
    sellerId: string;
    orderId: string;
    amount: number;
    platform: 'marketplace'; // Orders currently marketplace only
  };
  'order:shipped': {
    buyerId: string;
    orderId: string;
    trackingNumber?: string;
  };
  'order:delivered': {
    buyerId: string;
    orderId: string;
  };
  
  // Social Events
  'user:followed': {
    followedUserId: string;
    followerName: string;
  };
  
  // ISO Events
  'iso:matched': {
    userId: string;
    isoId: string;
    matchedListingId: string;
  };
}

/**
 * Typed EventEmitter for decoupled side-effects
 */
export class TypedEventEmitter {
  private emitter = new NodeEventEmitter();

  /**
   * Emit an event with its typed payload
   */
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    logger.debug('Event emitted', { event, data });
    this.emitter.emit(event, data);
  }

  /**
   * Subscribe to an event with a typed handler
   * Supports both sync and async handlers with automatic error isolation
   */
  on<K extends keyof EventMap>(
    event: K, 
    handler: (data: EventMap[K]) => void | Promise<void>
  ): void {
    this.emitter.on(event, async (data) => {
      try {
        await handler(data);
      } catch (error) {
        logger.error(`Error in event handler for "${event}"`, { 
          event, 
          data, 
          error: error instanceof Error ? error.message : error 
        });
      }
    });
  }

  /**
   * Remove a specific listener
   */
  off<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): void {
    this.emitter.off(event, handler);
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends keyof EventMap>(event?: K): void {
    this.emitter.removeAllListeners(event);
  }
}

// Export singleton instance
export const events = new TypedEventEmitter();
