/**
 * Offer Service
 * 
 * Business logic for offer lifecycle management.
 * 
 * Key features:
 * - Uses first-class Offer and OfferRevision models
 * - Atomic transactions for state changes
 * - Event-driven side-effects via EventOutbox
 * - Chat integration via chatService
 * - Listing reservation on acceptance
 */

import mongoose, { Types } from "mongoose";
import { NotFoundError, ValidationError } from "../../utils/errors";
import { 
  Platform,
  channelRepository,
} from "../../repositories";
import { 
  MarketplaceListing, 
  NetworkListing 
} from "../../models/Listings";
import { NetworkListingChannel } from "../../models/ListingChannel";
import { MarketplaceListingChannel } from "../../models/MarketplaceListingChannel";
import { Order } from "../../models/Order";
import { Offer, IOffer } from "../../models/Offer";
import { OfferRevision, IOfferRevision } from "../../models/OfferRevision";
import { ReservationTerms } from "../../models/ReservationTerms";
import { EventOutbox, EventType } from "../../models/EventOutbox";
import { chatService } from "../ChatService";
import logger from "../../utils/logger";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export interface SendOfferParams {
  channelId: string;
  listingId: string;
  senderId: string;
  receiverId: string;
  amount: number;
  currency?: string;
  note?: string;
  platform: Platform;
  expiresInHours?: number;
  getstreamChannelId?: string;
}

export interface SendOfferResponse {
  offer: IOffer;
  revision: IOfferRevision;
}

export interface CounterOfferParams {
  offerId: string;
  counterById: string;
  amount: number;
  currency?: string;
  note?: string;
  expiresInHours?: number;
}

export interface AcceptOfferResponse {
  offer: IOffer;
  revision: IOfferRevision;
  channelId: string;
  amount: number;
  orderId: string;
}

// ----------------------------------------------------------
// OfferService Implementation
// ----------------------------------------------------------

export class OfferService {
  private static readonly DEFAULT_OFFER_EXPIRY_HOURS = 48;

  /**
   * Send an initial offer on a listing channel.
   * Creates Offer + first OfferRevision + EventOutbox entry in a transaction.
   */
  async sendOffer(params: SendOfferParams, session?: mongoose.ClientSession): Promise<SendOfferResponse> {
    const {
      channelId,
      listingId,
      senderId,
      receiverId,
      amount,
      currency = "USD",
      note,
      platform,
      expiresInHours = OfferService.DEFAULT_OFFER_EXPIRY_HOURS,
      getstreamChannelId,
    } = params;

    const useExternalSession = !!session;
    const txnSession = useExternalSession ? session : await mongoose.startSession();
    if (!useExternalSession) txnSession.startTransaction();

    let offer: any;
    let revision: any;
    let listingSnapshot: any;
    let getstreamChannelIdToUse: string = getstreamChannelId || "";

    try {
      // 1. Get the listing to validate + snapshot (inside transaction)
      const ListingModel = platform === "networks" ? NetworkListing : MarketplaceListing;
      const listing = await (ListingModel as any).findById(listingId).session(txnSession);
      
      if (!listing) throw new NotFoundError("Listing");
      if (listing.status !== "active") throw new ValidationError("Listing is not active");
      if (listing.price && amount >= listing.price) throw new ValidationError("Offer must be below asking price");

      listingSnapshot = {
        brand: (listing as any).brand || "",
        model: (listing as any).model || "",
        reference: (listing as any).reference || "",
        price: listing.price,
        condition: (listing as any).condition,
        thumbnail: (listing as any).thumbnail || (listing as any).images?.[0],
      };

      // 2. Check for existing active offer (match unique index) - inside transaction
      const existingOffer = await (Offer as any).findOne({
        listing_id: new Types.ObjectId(listingId),
        buyer_id: new Types.ObjectId(senderId),
        state: { $in: ["CREATED", "COUNTERED"] },
      }).session(txnSession);

      if (existingOffer) {
        throw new ValidationError(
          "An active offer already exists. Accept, counter, or wait for expiry."
        );
      }

      const expiresAt = new Date(
        Date.now() + expiresInHours * 60 * 60 * 1000
      );

      // Create offer
      offer = new Offer({
        listing_id: new Types.ObjectId(listingId),
        channel_id: new Types.ObjectId(channelId),
        buyer_id: new Types.ObjectId(senderId),
        seller_id: new Types.ObjectId(receiverId),
        platform,
        getstream_channel_id: getstreamChannelIdToUse,
        state: "CREATED",
        expires_at: expiresAt,
        listing_snapshot: listingSnapshot,
      });
      await offer.save({ session: txnSession });

      // Get current terms
      // Note: ReservationTerms.getCurrent() doesn't seem to support session in its static method if not modified
      const currentTerms = await ReservationTerms.getCurrent();

      // Create revision
      revision = new OfferRevision({
        offer_id: offer._id,
        amount,
        currency,
        note,
        reservation_terms_id: currentTerms?._id,
        created_by: new Types.ObjectId(senderId),
        revision_number: 1,
      });
      await revision.save({ session: txnSession });

      // Link revision to offer
      offer.active_revision_id = revision._id;
      await offer.save({ session: txnSession });

      // Write to outbox
      const outboxEntry = new EventOutbox({
        aggregate_type: "offer",
        aggregate_id: offer._id,
        event_type: "OFFER_CREATED" as EventType,
        payload: {
          offerId: offer._id.toString(),
          revisionId: revision._id.toString(),
          channelId,
          listingId,
          buyerId: senderId,
          sellerId: receiverId,
          amount,
          currency,
          platform,
          expiresAt: expiresAt.toISOString(),
        },
        published: false,
      });
      await outboxEntry.save({ session: txnSession });

      if (!useExternalSession) await txnSession.commitTransaction();
    } catch (error) {
      if (!useExternalSession && txnSession.inTransaction()) {
        await txnSession.abortTransaction();
      }
      throw error;
    } finally {
      if (!useExternalSession) txnSession.endSession();
    }

    // --- Post-Transaction Side Effects ---
    
    // Also update channel for backward compatibility
    await this.updateChannelLastOffer(channelId, platform, {
      _id: offer._id,
      sender_id: senderId,
      amount,
      status: "sent",
      offer_type: "initial",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
    });

    // 5. Send system message (Legacy parity)
    if (getstreamChannelId) {
      try {
        await chatService.sendSystemMessage(
          getstreamChannelId,
          {
            type: "offer",
            amount,
            message: `New offer for $${amount}`,
          },
          senderId
        );
      } catch (chatError) {
        logger.warn("[OfferService] Failed to send offer system message", {
          channelId,
          chatError,
        });
      }
    }

    logger.info("[OfferService] Offer created", {
      offerId: offer._id.toString(),
      channelId,
      listingId,
      amount,
      platform,
    });

    return { offer, revision };
  }

  /**
   * Counter an existing offer.
   * Transitions state to COUNTERED, creates new revision.
   */
  async counterOffer(params: CounterOfferParams): Promise<SendOfferResponse> {
    const {
      offerId,
      counterById,
      amount,
      currency = "USD",
      note,
      expiresInHours = OfferService.DEFAULT_OFFER_EXPIRY_HOURS,
    } = params;

    const session = await mongoose.startSession();
    session.startTransaction();

    let offer: any;
    let revision: any;

    try {
      // 1. Get offer with optimistic locking
      offer = await Offer.findById(offerId).session(session);
      if (!offer) throw new Error("Offer not found");

      if (!offer.isActive()) {
        throw new Error(
          `Offer cannot be countered in state: ${offer.state}`
        );
      }

      // 2. Verify counter party is the other side of the offer
      const isBuyer = offer.buyer_id.toString() === counterById;
      const isSeller = offer.seller_id.toString() === counterById;
      if (!isBuyer && !isSeller) {
        throw new Error("Only buyer or seller can counter this offer");
      }

      // 3. Get latest revision for numbering
      const latestRevision = await OfferRevision.getLatestRevision(offerId);
      const nextRevisionNumber = latestRevision
        ? latestRevision.revision_number + 1
        : 1;

      // 4. Get current terms
      const currentTerms = await ReservationTerms.getCurrent();

      // 5. Create new revision
      [revision] = await OfferRevision.create(
        [
          {
            offer_id: offer._id,
            amount,
            currency,
            note,
            reservation_terms_id: currentTerms?._id,
            created_by: new Types.ObjectId(counterById),
            revision_number: nextRevisionNumber,
          },
        ],
        { session }
      );

      // 6. Update offer state
      const previousState = offer.state;
      offer.state = "COUNTERED";
      offer.active_revision_id = revision._id;
      offer.expires_at = new Date(
        Date.now() + expiresInHours * 60 * 60 * 1000
      );
      await offer.save({ session });

      // 7. Write outbox
      await EventOutbox.create(
        [
          {
            aggregate_type: "offer",
            aggregate_id: offer._id,
            event_type: "OFFER_COUNTERED" as EventType,
            payload: {
              offerId: offer._id.toString(),
              revisionId: revision._id.toString(),
              channelId: offer.channel_id.toString(),
              counterById,
              amount,
              currency,
              platform: offer.platform,
              previousState,
            },
            published: false,
          },
        ],
        { session }
      );

      await session.commitTransaction();
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }

    // --- Post-Transaction Side Effects ---

    // 9. Send system message (Legacy parity)
    if (offer.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          offer.getstream_channel_id,
          {
            type: "counter_offer",
            amount,
            message: `Counter offer for $${amount}`,
          },
          counterById
        );
      } catch (chatError) {
        logger.warn("[OfferService] Failed to send counter system message", {
          offerId: offer._id,
          chatError,
        });
      }
    }

    logger.info("[OfferService] Offer countered", {
      offerId: offer._id.toString(),
      amount,
    });

    return { offer, revision };
  }

  /**
   * Accept an offer.
   * Transitions to ACCEPTED, writes outbox.
   * Returns data needed for order creation (caller handles order).
   */
  async acceptOffer(
    offerId: string,
    acceptorId: string,
    _platform?: string // Backward compat: platform is stored on Offer doc
  ): Promise<AcceptOfferResponse> {
    const session = await mongoose.startSession();
    session.startTransaction();

    let offer: any;
    let latestRevision: any;
    let previousState: string = "";
    let orderId: string = "";

    try {
      // 1. Get offer
      offer = await Offer.findById(offerId).session(session);
      if (!offer) throw new Error("Offer not found");

      if (!offer.canBeAccepted()) {
        throw new Error(
          `Offer cannot be accepted in state: ${offer.state}${offer.isExpired() ? " (expired)" : ""}`
        );
      }

      // 2. Verify acceptor is the correct party
      latestRevision = await OfferRevision.getLatestRevision(offerId);
      if (!latestRevision) {
        throw new Error("No revision found for this offer");
      }

      if (latestRevision.created_by.toString() === acceptorId) {
        throw new Error("Cannot accept your own offer/counter");
      }

      const isBuyer = offer.buyer_id.toString() === acceptorId;
      const isSeller = offer.seller_id.toString() === acceptorId;
      if (!isBuyer && !isSeller) {
        throw new Error("Only buyer or seller can accept this offer");
      }

      // 3. Update offer state
      previousState = offer.state;
      offer.state = "ACCEPTED";
      await offer.save({ session });

      // 4. Reserve listing
      const ListingModel = offer.platform === "networks" ? NetworkListing : MarketplaceListing;
      const channel = await channelRepository.findById(offer.channel_id.toString(), offer.platform);
      
      await (ListingModel as any).updateOne(
        { _id: offer.listing_id },
        { 
          $set: { 
            status: "reserved",
            order: {
              channel_id: offer.channel_id,
              reserved_at: new Date(),
              buyer_name: (channel as any)?.buyer_snapshot?.name || "Buyer",
              buyer_id: offer.buyer_id
            }
          } 
        },
        { session }
      );

      // 4. Create Order
      const order = new Order({
        listing_type: offer.platform === "networks" ? "NetworkListing" : "MarketplaceListing",
        listing_id: offer.listing_id,
        listing_snapshot: {
          brand: (channel as any)?.listing_snapshot?.brand || "",
          model: (channel as any)?.listing_snapshot?.model || "",
          reference: (channel as any)?.listing_snapshot?.reference || "",
          price: (channel as any)?.listing_snapshot?.price || latestRevision.amount,
        },
        buyer_id: offer.buyer_id,
        seller_id: offer.seller_id,
        amount: latestRevision.amount,
        currency: latestRevision.currency || "USD",
        status: "pending",
        offer_id: offer._id,
        offer_revision_id: latestRevision._id,
        channel_id: offer.channel_id,
        channel_type: offer.platform === "networks" ? "NetworkListingChannel" : "MarketplaceListingChannel",
        getstream_channel_id: offer.getstream_channel_id,
        reserved_at: new Date(),
      });
      await order.save({ session });
      orderId = order._id.toString();

      // 5. Write outbox
      await EventOutbox.create(
        [
          {
            aggregate_type: "offer",
            aggregate_id: offer._id,
            event_type: "OFFER_ACCEPTED" as EventType,
            payload: {
              offerId: offer._id.toString(),
              orderId,
              acceptedBy: acceptorId,
              amount: latestRevision.amount,
              buyerId: offer.buyer_id.toString(),
              sellerId: offer.seller_id.toString(),
              channelId: offer.channel_id.toString(),
              platform: offer.platform,
              previousState,
              revisionId: latestRevision._id.toString(),
            },
            published: false,
          },
        ],
        { session }
      );

      // 5. Update channel status for backward compatibility
      await this.updateChannelStatus(
        offer.channel_id.toString(),
        offer.platform,
        "accepted",
        session
      );

      await session.commitTransaction();
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }

    // --- Post-Transaction Side Effects ---
    // 6. Send system message (Legacy parity)
    if (offer.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          offer.getstream_channel_id,
          {
            type: "offer_accepted",
            amount: latestRevision.amount,
            message: "Offer accepted!",
          },
          acceptorId
        );
        
        await chatService.sendSystemMessage(
          offer.getstream_channel_id,
          {
            type: "listing_reserved",
            message: "Listing reserved",
          },
          acceptorId
        );
      } catch (chatError) {
        logger.warn("[OfferService] Failed to send acceptance system message", {
          offerId: offer._id,
          chatError,
        });
      }
    }

    logger.info("[OfferService] Offer accepted", {
      offerId: offer._id.toString(),
      amount: latestRevision.amount,
      acceptedBy: acceptorId,
    });

    return {
      offer,
      revision: latestRevision,
      channelId: offer.channel_id.toString(),
      amount: latestRevision.amount,
      orderId,
    };
  }

  /**
   * Decline an offer.
   */
  async declineOffer(offerId: string, declinedById: string): Promise<IOffer> {
    const session = await mongoose.startSession();
    session.startTransaction();

    let offer: any;
    let latestRevision: any;

    try {
      offer = await Offer.findById(offerId).session(session);
      if (!offer) throw new Error("Offer not found");

      if (!offer.isActive()) {
        throw new Error(`Offer cannot be declined in state: ${offer.state}`);
      }

      const isBuyer = offer.buyer_id.toString() === declinedById;
      const isSeller = offer.seller_id.toString() === declinedById;
      if (!isBuyer && !isSeller) {
        throw new Error("Only buyer or seller can decline this offer");
      }

      const previousState = offer.state;
      offer.state = "DECLINED";
      await offer.save({ session });

      latestRevision = await OfferRevision.getLatestRevision(offerId);

      // Write outbox
      await EventOutbox.create(
        [
          {
            aggregate_type: "offer",
            aggregate_id: offer._id,
            event_type: "OFFER_DECLINED" as EventType,
            payload: {
              offerId: offer._id.toString(),
              declinedBy: declinedById,
              platform: offer.platform,
              previousState,
            },
            published: false,
          },
        ],
        { session }
      );

      await session.commitTransaction();
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }

    // Side effect
    if (offer.getstream_channel_id) {
        try {
            await chatService.sendSystemMessage(
              offer.getstream_channel_id,
              {
                type: "offer_rejected",
                amount: latestRevision?.amount,
                message: "Offer declined",
              },
              declinedById
            );
        } catch (e) {
            logger.warn("[OfferService] Failed to send decline message", e);
        }
    }

    return offer;
  }

  /**
   * Expire an offer.
   */
  async expireOffer(offerId: string): Promise<IOffer> {
    const session = await mongoose.startSession();
    session.startTransaction();

    let offer: any;
    let latestRevision: any;

    try {
      offer = await Offer.findById(offerId).session(session);
      if (!offer) throw new Error("Offer not found");

      if (!offer.isActive()) {
        // Already handled or moved to final state
        await session.abortTransaction();
        session.endSession();
        return offer;
      }

      const previousState = offer.state;
      offer.state = "EXPIRED";
      await offer.save({ session });

      latestRevision = await OfferRevision.getLatestRevision(offerId);

      // Write outbox
      await EventOutbox.create(
        [
          {
            aggregate_type: "offer",
            aggregate_id: offer._id,
            event_type: "OFFER_EXPIRED" as EventType,
            payload: {
              offerId: offer._id.toString(),
              platform: offer.platform,
              previousState,
            },
            published: false,
          },
        ],
        { session }
      );

      await session.commitTransaction();
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }

    // Side effect
    if (offer.getstream_channel_id) {
        try {
            await chatService.sendSystemMessage(
              offer.getstream_channel_id,
              {
                type: "offer_expired",
                amount: latestRevision?.amount,
                message: "Offer expired",
              },
              "system"
            );
        } catch (e) {
            logger.warn("[OfferService] Failed to send expiry message", e);
        }
    }

    return offer;
  }

  /**
   * Get all expired offers (CREATED/COUNTERED and passed expires_at)
   */
  async getExpiredOffers(): Promise<IOffer[]> {
    return Offer.findExpiredOffers();
  }

  /**
   * Backward Compatibility: Update the channel document's last_offer field.
   */
  async updateChannelLastOffer(
    channelId: string,
    platform: Platform,
    lastOfferData: any,
    session?: any
  ): Promise<void> {
    const ChannelModel =
      platform === "marketplace"
        ? MarketplaceListingChannel
        : NetworkListingChannel;

    try {
      await ChannelModel.findByIdAndUpdate(
        channelId,
        {
          $set: {
            last_offer: lastOfferData,
            last_event_type: "offer",
          },
        },
        { session }
      );
    } catch (error) {
      logger.warn("[OfferService] Failed to update channel last offer", {
        channelId,
        error,
      });
    }
  }

  /**
   * Backward Compatibility: Update the channel document's status field.
   */
  async updateChannelStatus(
    channelId: string,
    platform: Platform,
    status: string,
    session?: any
  ): Promise<void> {
    const ChannelModel =
      platform === "marketplace"
        ? MarketplaceListingChannel
        : NetworkListingChannel;

    try {
      await ChannelModel.findByIdAndUpdate(
        channelId,
        { $set: { status } },
        { session }
      );
    } catch (error) {
      logger.warn("[OfferService] Failed to update channel status", {
        channelId,
        error,
      });
    }
  }
}

// Export singleton instance
export const offerService = new OfferService();

// Backward-compat method aliases used by existing route handlers
(OfferService.prototype as any).rejectOffer = OfferService.prototype.declineOffer;
