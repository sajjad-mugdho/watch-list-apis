import { EventEmitter } from "events";
import { IMarketplaceListing, INetworkListing } from "../models/Listings";

/**
 * Listing Events
 * 
 * Centralized event bus for listing lifecycle events.
 * Used to decouple background processes (like matching ISOs) from the HTTP request cycle.
 */

// Define event names as constants to prevent typos
export const LISTING_EVENTS = {
  CREATED: "listing:created",
  PUBLISHED: "listing:published",
  UPDATED: "listing:updated",
} as const;

// Define payload types
export type ListingPublishedPayload = IMarketplaceListing | INetworkListing;

class ListingEventEmitter extends EventEmitter {
  /**
   * Emit 'listing:published' event
   * Triggered when a listing goes from 'draft' to 'active'
   */
  emitPublished(listing: ListingPublishedPayload): void {
    this.emit(LISTING_EVENTS.PUBLISHED, listing);
  }
}

// Export singleton
export const listingEvents = new ListingEventEmitter();
