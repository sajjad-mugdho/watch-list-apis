/**
 * ISO Matching Service
 *
 * Matches new listings against active ISOs (In Search Of) requests
 * and notifies ISO owners when relevant listings are published.
 */

import { Types } from "mongoose";
import { ISO, IISO } from "../models/ISO";
import { Notification } from "../models/Notification";
import { feedService } from "./FeedService";
import logger from "../utils/logger";

// Interface for listing data we receive
interface ListingData {
  _id?: any;  // Can be ObjectId or string
  id?: string;
  dialist_id?: any;  // Can be ObjectId or string
  brand?: string;
  model?: string;
  reference?: string;
  price?: number;
  condition?: string;
  title?: string;
  thumbnail?: string;
}

import { listingEvents, LISTING_EVENTS, ListingPublishedPayload } from "../events/listingEvents";

class ISOMatchingService {
  
  constructor() {
    this.initialize();
  }

  /**
   * Initialize event listeners
   */
  private initialize(): void {
    listingEvents.on(LISTING_EVENTS.PUBLISHED, this.handleListingPublished.bind(this));
    logger.info("ISOMatchingService initialized and listening for events");
  }

  /**
   * Handle 'listing:published' event
   */
  private async handleListingPublished(listing: ListingPublishedPayload): Promise<void> {
    try {
      // Cast to match internal ListingData interface if needed
      // The event payload (Mongoose doc) usually satisfies or exceeds ListingData
      await this.matchNewListing(listing as unknown as ListingData);
    } catch (error) {
      logger.error("Error handling listing published event in ISOMatchingService", { 
        error, 
        listingId: (listing as any)._id 
      });
    }
  }

  /**
   * Match a newly published listing against all active ISOs
   * Notifies ISO owners whose criteria match the listing
   */
  async matchNewListing(listing: ListingData): Promise<void> {
    try {
      const listingId = listing._id || listing.id;
      
      // Build query for matching ISOs
      const query: any = {
        status: "active",
        // Don't match against the seller's own ISOs
        user_id: { $ne: listing.dialist_id },
      };

      // Find all active ISOs that could potentially match
      const potentialMatches = await ISO.find(query);

      logger.info("Checking ISO matches for new listing", {
        listingId,
        listingBrand: listing.brand,
        listingPrice: listing.price,
        potentialISOCount: potentialMatches.length,
      });

      for (const iso of potentialMatches) {
        const isMatch = this.checkMatch(iso, listing);

        if (isMatch) {
          // Fire and forget notification to avoid blocking the match loop
          this.notifyISOOwner(iso, listing).catch(err => 
            logger.error("Async notification failed during matching", { err, isoId: iso._id })
          );
        }
      }
    } catch (error) {
      const listingId = listing._id || listing.id;
      logger.error("Error matching listing to ISOs", { error, listingId });
    }
  }

  /**
   * Check if a listing matches an ISO's criteria
   */
  private checkMatch(iso: IISO, listing: ListingData): boolean {
    const criteria = iso.criteria;

    // Brand match (if specified)
    if (criteria.brand && listing.brand) {
      if (criteria.brand.toLowerCase() !== listing.brand.toLowerCase()) {
        return false;
      }
    }

    // Model match (if specified)
    if (criteria.model && listing.model) {
      if (!listing.model.toLowerCase().includes(criteria.model.toLowerCase())) {
        return false;
      }
    }

    // Reference match (if specified)
    if (criteria.reference && listing.reference) {
      if (!listing.reference.toLowerCase().includes(criteria.reference.toLowerCase())) {
        return false;
      }
    }

    // Price range match (ISO only has max_price)
    if (criteria.max_price !== undefined && listing.price !== undefined) {
      if (listing.price > criteria.max_price) {
        return false;
      }
    }

    // Condition match (if specified)
    if (criteria.condition && listing.condition) {
      if (criteria.condition.toLowerCase() !== listing.condition.toLowerCase()) {
        return false;
      }
    }

    // If we passed all checks, it's a match
    return true;
  }

  /**
   * Notify ISO owner about a matching listing
   */
  private async notifyISOOwner(iso: IISO, listing: ListingData): Promise<void> {
    try {
      const listingId = String(listing._id || listing.id);
      
      logger.info("ISO match found - notifying owner", {
        isoId: iso._id,
        isoUserId: iso.user_id,
        listingId,
        listingTitle: listing.title,
      });

      // Add activity to ISO owner's timeline feed
      await feedService.addActivity(String(iso.user_id), {
        verb: "iso_match",
        object: `listing:${listingId}`,
        foreign_id: `iso_match:${iso._id}:${listingId}`,
        type: "iso_match",
        extra: {
          iso_id: String(iso._id),
          listing_id: listingId,
          listing_title: listing.title || "Matching Listing",
          listing_price: listing.price || 0,
          listing_thumbnail: listing.thumbnail,
          iso_title: iso.title,
          notification_message: `A listing matching your ISO "${iso.title}" has been posted!`,
        },
      });
      
      // Also create an in-app notification
      await Notification.create({
        user_id: iso.user_id,
        type: "iso_match",
        title: "Match Found!",
        body: `A listing matching your ISO "${iso.title}" has been posted!`,
        data: {
          iso_id: String(iso._id),
          listing_id: listingId,
        },
        action_url: `/listings/${listingId}`,
      });

      // Increment match count on ISO (if field exists)
      await ISO.findByIdAndUpdate(iso._id, {
        $inc: { match_count: 1 },
        $set: { last_matched_at: new Date() },
      });

    } catch (error) {
      logger.error("Failed to notify ISO owner", { error, isoId: iso._id });
    }
  }

  /**
   * Manually check matches for a specific ISO
   * Useful when an ISO is created or updated
   */
  async checkMatchesForISO(isoId: Types.ObjectId | string): Promise<number> {
    try {
      const iso = await ISO.findById(isoId);
      if (!iso || iso.status !== "active") {
        return 0;
      }

      // Import dynamically to avoid circular dependency
      const { MarketplaceListing } = await import("../models/Listings");

      // Build query based on ISO criteria
      const query: any = {
        status: "active",
        dialist_id: { $ne: iso.user_id }, // Exclude own listings
      };

      if (iso.criteria.brand) {
        query.brand = new RegExp(iso.criteria.brand, "i");
      }

      if (iso.criteria.max_price) {
        query.price = { $lte: iso.criteria.max_price };
      }

      const matchingListings = await MarketplaceListing.find(query).limit(10);

      logger.info("Found matches for ISO", {
        isoId,
        matchCount: matchingListings.length,
      });

      // Notify about top matches
      for (const listing of matchingListings.slice(0, 5)) {
        // Convert mongoose document to plain object for type safety
        const listingData: ListingData = {
          _id: String(listing._id),
          dialist_id: String(listing.dialist_id),
        };
        
        // Only add optional fields if they exist
        if (listing.brand) listingData.brand = listing.brand;
        if (listing.model) listingData.model = listing.model;
        if (listing.reference) listingData.reference = listing.reference;
        if (listing.price !== undefined) listingData.price = listing.price;
        if (listing.condition) listingData.condition = listing.condition;
        if (listing.title) listingData.title = listing.title;
        if (listing.thumbnail) listingData.thumbnail = listing.thumbnail;
        
        if (this.checkMatch(iso, listingData)) {
          this.notifyISOOwner(iso, listingData).catch(err =>
             logger.error("Async notification failed for manual check", { err, isoId })
          );
        }
      }

      return matchingListings.length;
    } catch (error) {
      logger.error("Error checking matches for ISO", { error, isoId });
      return 0;
    }
  }
}

export const isoMatchingService = new ISOMatchingService();
export { ISOMatchingService };
