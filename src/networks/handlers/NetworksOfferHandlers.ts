import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

// Order model imported for potential future use in offer flow
// import { Order } from "../../models/Order";
import { Block } from "../models/Block";
import {
  AppError,
  NotFoundError,
  ValidationError,
  AuthorizationError,
  MissingUserContextError,
  DatabaseError,
} from "../../utils/errors";
import { ApiResponse } from "../../types";
import {
  SendOfferInput,
  CounterOfferInput,
  ChannelActionInput,
  GetUserChannelsInput,
  GetListingChannelsInput,
} from "../../validation/schemas";
import { chatService } from "../../services/ChatService";
import logger from "../../utils/logger";

import {
  INetworkListingChannel,
  NetworkListingChannel,
} from "../models/NetworkListingChannel";
import { INetworkListing, NetworkListing } from "../models/NetworkListing";
import { networksOfferService } from "./../../networks/services/NetworksOfferService";
import { Offer } from "../../models/Offer";
import { OfferRevision } from "../../models/OfferRevision";
import { networksNotificationService } from "../services/NotificationService";

// ----------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------

function validateOfferEligibility(
  listing: INetworkListing,
  buyerId: string,
  amount: number,
): void {
  if (listing.status !== "active") {
    throw new ValidationError("Listing is not active");
  }

  if (!listing.allow_offers) {
    throw new ValidationError("Offers not allowed on this listing");
  }

  if (String(listing.dialist_id) === String(buyerId)) {
    throw new ValidationError("Cannot make offer on own listing");
  }

  if (listing.price && amount >= listing.price) {
    throw new ValidationError("Offer must be below asking price");
  }

  if (amount <= 0) {
    throw new ValidationError("Offer amount must be positive");
  }
}

function validateCounterAmount(
  channel: INetworkListingChannel,
  userId: string,
  newAmount: number,
): void {
  const lastOffer = channel.last_offer;
  if (!lastOffer) throw new ValidationError("No offer to counter");

  const userRole = channel.getUserRole(userId);

  if (userRole === "buyer" && newAmount > lastOffer.amount) {
    throw new ValidationError("Buyer counter must not exceed current offer");
  }

  if (userRole === "seller" && newAmount < lastOffer.amount) {
    throw new ValidationError("Seller counter must not be below current offer");
  }
}

async function resolveOfferAndChannelByRouteId(
  routeId: string,
  activeOnly: boolean = false,
): Promise<{ offer: any; channel: any }> {
  if (!mongoose.Types.ObjectId.isValid(routeId)) {
    throw new ValidationError("Invalid offer ID");
  }

  const stateFilter = activeOnly
    ? { state: { $in: ["CREATED", "COUNTERED"] as const } }
    : {};

  // Canonical path: treat route id as offer id.
  let offer = await Offer.findOne({
    _id: new mongoose.Types.ObjectId(routeId),
    platform: "networks",
    ...stateFilter,
  });

  // Backward compatibility: old clients may still send channel id.
  if (!offer) {
    offer = await Offer.findOne({
      channel_id: new mongoose.Types.ObjectId(routeId),
      platform: "networks",
      ...stateFilter,
    }).sort({ updatedAt: -1 });
  }

  if (!offer) {
    throw new NotFoundError("Offer");
  }

  const channel = await NetworkListingChannel.findById(offer.channel_id);
  if (!channel) throw new NotFoundError("Channel");

  return { offer, channel };
}

// ----------------------------------------------------------
// Handler Functions
// ----------------------------------------------------------

/**
 * Send initial offer on a listing
 * POST /api/v1/networks/listings/:id/offers
 */
export const networks_offer_send = async (
  req: Request<SendOfferInput["params"], {}, SendOfferInput["body"]>,
  res: Response<ApiResponse<INetworkListingChannel>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();

    const { id: listingId } = req.params;
    const buyerId = (req as any).user.dialist_id;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      throw new ValidationError("Invalid listing ID");
    }

    const listing = await NetworkListing.findById(listingId);
    if (!listing) throw new NotFoundError("Listing");

    const sellerId = listing.dialist_id.toString();

    // Block check
    const isBlocked = await Block.findOne({
      $or: [
        { blocker_id: buyerId, blocked_id: sellerId },
        { blocker_id: sellerId, blocked_id: buyerId },
      ],
    });

    if (isBlocked) {
      throw new AuthorizationError(
        "Cannot interact with this user due to a block",
        {},
      );
    }

    const {
      amount,
      message,
      shipping_region,
      request_free_shipping,
      reservation_terms_snapshot,
    } = req.body;

    validateOfferEligibility(listing, buyerId, amount);

    // Check for existing channel
    // For Networks, channels are unique per participant pair (User to User)
    const existingChannel = await NetworkListingChannel.findOne({
      $or: [
        { buyer_id: buyerId, seller_id: sellerId },
        { buyer_id: sellerId, seller_id: buyerId },
      ],
    });

    if (existingChannel) {
      if (existingChannel.status === "closed") {
        throw new ValidationError("Channel is closed");
      }

      if (existingChannel.hasActiveOffer()) {
        throw new ValidationError(
          "An active offer already exists on this channel",
        );
      }

      // Keep historical timeline, but do not persist it until canonical offer creation succeeds.
      existingChannel.supersedeLastOffer();

      const { offer } = await networksOfferService.sendOffer({
        channelId: (existingChannel._id as any).toString(),
        listingId,
        senderId: String(buyerId),
        receiverId: String(sellerId),
        amount,
        ...(message != null && { note: message }),
        ...(existingChannel.getstream_channel_id && {
          getstreamChannelId: existingChannel.getstream_channel_id,
        }),
      });

      // For reused channels, update the listing snapshot to the current inquiry.
      existingChannel.listing_id = listingId as any;
      existingChannel.listing_snapshot = {
        brand: listing.brand || "Unknown",
        model: listing.model || "Unknown",
        reference: listing.reference || "Unknown",
        price: listing.price,
        ...(listing.condition && { condition: listing.condition }),
        ...(listing.contents && { contents: listing.contents }),
        ...(listing.thumbnail && { thumbnail: listing.thumbnail }),
        ...(listing.year && { year: listing.year }),
      };

      // Preserve canonical offer identity/timestamps and only merge networks-specific fields.
      existingChannel.last_offer = {
        _id: (offer._id as any) || undefined,
        sender_id: buyerId as any,
        amount,
        message: message || null,
        shipping_region: shipping_region || null,
        request_free_shipping: !!request_free_shipping,
        reservation_terms_snapshot:
          reservation_terms_snapshot || listing.reservation_terms || null,
        offer_type: "initial",
        status: "sent",
        expiresAt: (offer.expires_at as any) || null,
        createdAt: (offer.createdAt as any) || new Date(),
      };
      existingChannel.last_event_type = "offer";
      await existingChannel.save();

      // Create in-app notification for seller
      try {
        await networksNotificationService.create({
          userId: String(listing.dialist_id),
          type: "offer_received",
          title: "Offer Received",
          body: `You received an offer of $${amount.toLocaleString()} for ${listing.brand} ${listing.model}`,
          actionUrl: `/networks/offers/${(offer._id as any).toString()}`,
          data: {
            listing_id: listingId,
            offer_id: (offer._id as any).toString(),
            channel_id: (existingChannel._id as any).toString(),
            amount,
          },
        });
      } catch (notifError) {
        logger.warn("Failed to create networks offer notification", {
          notifError,
        });
      }

      const response: ApiResponse<INetworkListingChannel> = {
        data: existingChannel.toJSON() as any,
        requestId: req.headers["x-request-id"] as string,
      };

      res.status(201).json(response);
      return;
    }

    // Create new channel with initial offer
    const channel = await NetworkListingChannel.create({
      listing_id: listingId as any,
      buyer_id: buyerId as any,
      seller_id: listing.dialist_id,
      status: "open",
      created_from: "offer",
      last_event_type: "offer",
      buyer_snapshot: {
        _id: buyerId as any,
        name: (req as any).user.display_name,
        avatar: (req as any).user.display_avatar,
      },
      seller_snapshot: {
        _id: listing.author._id,
        name: listing.author.name,
        avatar: listing.author.avatar,
      },
      listing_snapshot: {
        brand: listing.brand,
        model: listing.model,
        reference: listing.reference,
        price: listing.price,
        condition: listing.condition,
        contents: listing.contents,
        thumbnail: listing.thumbnail,
        year: listing.year,
      },
      inquiry: null,
      offer_history: [],
      last_offer: null,
      order_id: null,
    });

    // Create Stream Chat channel for this conversation
    try {
      const { channelId: getstreamChannelId } =
        await chatService.getOrCreateChannel(
          buyerId,
          sellerId,
          {
            listing_id: listingId,
            listing_title: `${listing.brand} ${listing.model}`,
            listing_price: listing.price,
            ...(listing.thumbnail && { listing_thumbnail: listing.thumbnail }),
          },
          false,
        ); // listingUnique = false for Networks

      // Store the Stream channel ID in our channel document
      channel.getstream_channel_id = getstreamChannelId;

      logger.info("Stream Chat channel created for offer", {
        channelId: channel._id,
        getstreamChannelId,
        listingId,
      });
    } catch (chatError) {
      // Log but don't fail - chat is enhancement, not critical path
      logger.error("Failed to create Stream Chat channel", {
        channelId: channel._id,
        error: chatError,
      });
    }

    try {
      const { offer } = await networksOfferService.sendOffer({
        channelId: (channel._id as any).toString(),
        listingId,
        senderId: String(buyerId),
        receiverId: String(sellerId),
        amount,
        ...(message != null && { note: message }),
        ...(channel.getstream_channel_id && {
          getstreamChannelId: channel.getstream_channel_id,
        }),
      });

      // Preserve canonical offer identity/timestamps and merge networks-specific fields.
      channel.last_offer = {
        _id: (offer._id as any) || undefined,
        sender_id: buyerId as any,
        amount,
        message: message || null,
        shipping_region: shipping_region || null,
        request_free_shipping: !!request_free_shipping,
        reservation_terms_snapshot:
          reservation_terms_snapshot || listing.reservation_terms || null,
        offer_type: "initial",
        status: "sent",
        expiresAt: (offer.expires_at as any) || null,
        createdAt: (offer.createdAt as any) || new Date(),
      };
      channel.last_event_type = "offer";
      await channel.save();
    } catch (offerError) {
      // Avoid leaving orphaned channels without a canonical offer.
      await channel.deleteOne();
      throw offerError;
    }

    // Create in-app notification for seller
    try {
      await networksNotificationService.create({
        userId: String(listing.dialist_id),
        type: "offer_received",
        title: "Offer Received",
        body: `You received an offer of $${amount.toLocaleString()} for ${listing.brand} ${listing.model}`,
        actionUrl: `/networks/offers/${(channel.last_offer?._id as any)?.toString?.() || (channel._id as any).toString()}`,
        data: {
          listing_id: listingId,
          offer_id: (channel.last_offer?._id as any)?.toString?.(),
          channel_id: (channel._id as any).toString(),
          amount,
        },
      });
    } catch (notifError) {
      logger.warn("Failed to create networks offer notification", {
        notifError,
      });
    }

    const response: ApiResponse<INetworkListingChannel> = {
      data: ((channel as any).toJSON?.() ?? channel) as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(201).json(response);
  } catch (err: any) {
    logger.error("Error sending offer", { error: err });
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to send offer", err));
    }
  }
};

/**
 * Counter an existing offer
 * POST /api/v1/networks/offers/:id/counter
 */
export const networks_offer_counter = async (
  req: Request<CounterOfferInput["params"], {}, CounterOfferInput["body"]>,
  res: Response<ApiResponse<INetworkListingChannel>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();

    const { id: routeId } = req.params;
    const { amount, message, reservation_terms } = req.body;

    const dialist_id = (req as any).user.dialist_id;
    if (!mongoose.Types.ObjectId.isValid((req as any).user.dialist_id)) {
      throw new ValidationError("Invalid dialist_id");
    }

    const { offer, channel } = await resolveOfferAndChannelByRouteId(
      routeId,
      true,
    );

    if (channel.status === "closed") {
      throw new ValidationError("Channel is closed");
    }

    // Must be member of channel
    const role = channel.getUserRole(dialist_id);
    if (!role) {
      throw new AuthorizationError(
        "Not authorized to counter on this channel",
        {},
      );
    }

    if (!channel.hasActiveOffer()) {
      throw new ValidationError("No active offer to counter");
    }

    const lastOffer = channel.last_offer;
    if (!lastOffer) throw new ValidationError("No offer to counter");

    // Cannot counter own offer
    if (String(lastOffer.sender_id) === dialist_id) {
      throw new ValidationError("Cannot counter your own offer");
    }

    // Validate counter amount
    validateCounterAmount(channel, dialist_id, amount);

    await networksOfferService.counterOffer({
      offerId: offer._id.toString(),
      counterById: dialist_id,
      amount,
      ...(message != null && { note: message }),
      ...(reservation_terms != null && { reservation_terms }),
    });

    // Update channel.last_offer for backward compatibility
    channel.supersedeLastOffer();
    channel.last_offer = {
      sender_id: dialist_id as any,
      amount,
      message: message || null,
      offer_type: "counter",
      status: "sent",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };
    channel.last_event_type = "offer";
    await channel.save();

    // Create in-app notification for recipient
    try {
      const recipientId =
        role === "buyer" ? String(channel.seller_id) : String(channel.buyer_id);

      await networksNotificationService.create({
        userId: recipientId,
        type: "counter_offer",
        title: "Counter Offer Received",
        body: `You received a counter offer of $${amount.toLocaleString()} for ${channel.listing_snapshot.brand} ${channel.listing_snapshot.model}`,
        actionUrl: `/networks/offers/${offer._id.toString()}`,
        data: {
          listing_id: channel.listing_id.toString(),
          offer_id: offer._id.toString(),
          channel_id: (channel._id as any).toString(),
          amount,
        },
      });
    } catch (notifError) {
      logger.warn("Failed to create networks counter offer notification", {
        notifError,
      });
    }

    const response: ApiResponse<INetworkListingChannel> = {
      data: channel.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(201).json(response);
  } catch (err: any) {
    logger.error("Error countering offer", { error: err });
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to counter offer", err));
    }
  }
};

/**
 * Accept an offer (creates order, updates listing)
 * POST /api/v1/networks/offers/:id/accept
 */
export const networks_offer_accept = async (
  req: Request<ChannelActionInput["params"], {}, {}>,
  res: Response<ApiResponse<INetworkListingChannel>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();

    const { id: routeId } = req.params;
    const userId = (req as any).user.dialist_id;

    const { offer, channel } = await resolveOfferAndChannelByRouteId(
      routeId,
      true,
    );

    // Delegate to service layer - handles all state transitions, EventOutbox, notifications
    await networksOfferService.acceptOffer(offer._id.toString(), userId);

    // Fetch updated channel
    const updatedChannel =
      (await NetworkListingChannel.findById(channel._id)) || channel;

    const response: ApiResponse<INetworkListingChannel> = {
      data: ((updatedChannel as any).toJSON?.() ?? updatedChannel) as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err: any) {
    logger.error("Error accepting offer", { error: err });
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to accept offer", err));
    }
  }
};

/**
 * Reject/decline an offer
 * POST /api/v1/networks/offers/:id/reject
 */
export const networks_offer_reject = async (
  req: Request<ChannelActionInput["params"], {}, {}>,
  res: Response<ApiResponse<INetworkListingChannel>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();

    const { id: routeId } = req.params;
    const userId = (req as any).user.dialist_id;

    const { offer, channel } = await resolveOfferAndChannelByRouteId(
      routeId,
      true,
    );

    // Delegate to service layer - handles state transitions, notifications, EventOutbox
    await networksOfferService.declineOffer(offer._id.toString(), userId);

    // Fetch updated channel
    const updatedChannel =
      (await NetworkListingChannel.findById(channel._id)) || channel;

    const response: ApiResponse<INetworkListingChannel> = {
      data: ((updatedChannel as any).toJSON?.() ?? updatedChannel) as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err: any) {
    logger.error("Error rejecting offer", { error: err });
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to reject offer", err));
    }
  }
};

/**
 * Get offer/channel details
 * GET /api/v1/networks/offers/:id
 */
export const networks_offer_get = async (
  req: Request<ChannelActionInput["params"], {}, {}>,
  res: Response<ApiResponse<INetworkListingChannel & { role: string }>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();

    const { id: routeId } = req.params;
    const userId = (req as any).user.dialist_id;

    const { offer, channel } = await resolveOfferAndChannelByRouteId(routeId);

    // Must be member
    const role = channel.getUserRole(userId);
    if (!role) {
      throw new AuthorizationError("Not authorized to view this channel", {});
    }

    const response: ApiResponse<INetworkListingChannel & { role: string }> = {
      data: {
        ...(((channel as any).toJSON?.() ?? channel) as any),
        offer_id: offer._id.toString(),
        role,
      } as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err: any) {
    logger.error("Error fetching channel", { error: err });
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch channel", err));
    }
  }
};

/**
 * Get offer terms history
 * GET /api/v1/networks/offers/:id/terms-history
 */
export const networks_offer_terms_history_get = async (
  req: Request<ChannelActionInput["params"], {}, {}>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();

    const { id: routeId } = req.params;
    const userId = (req as any).user.dialist_id;

    const { offer, channel } = await resolveOfferAndChannelByRouteId(routeId);

    // Must be member of the conversation to read terms history.
    const role = channel.getUserRole(userId);
    if (!role) {
      throw new AuthorizationError("Not authorized to view this offer", {});
    }

    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [revisions, total] = await Promise.all([
      OfferRevision.find({ offer_id: offer._id })
        .sort({ revision_number: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      OfferRevision.countDocuments({ offer_id: offer._id }),
    ]);

    const response: ApiResponse<any> = {
      data: {
        offer_id: offer._id.toString(),
        channel_id: channel._id.toString(),
        revisions,
      },
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        total,
        limit,
        offset,
      },
    };

    res.json(response);
  } catch (err: any) {
    logger.error("Error fetching offer terms history", { error: err });
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch offer terms history", err));
    }
  }
};

/**
 * Get user's channels (sent or received offers)
 * GET /api/v1/networks/user/offers?type=sent|received
 */
export const networks_user_offers_get = async (
  req: Request<{}, {}, {}, GetUserChannelsInput["query"]>,
  res: Response<ApiResponse<INetworkListingChannel[]>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();

    const userId = (req as any).user.dialist_id;
    const { type, status, limit = 20, offset = 0 } = req.query;

    // Determine role filter
    let role: "buyer" | "seller" | undefined;
    if (type === "sent") role = "buyer";
    if (type === "received") role = "seller";

    // Get channels
    let channels = await NetworkListingChannel.findByUserId(userId, role);

    // Filter by status if provided
    if (status && status !== "all") {
      if (status === "active") {
        channels = channels.filter((c) => c.hasActiveOffer());
      } else if (status === "expired") {
        channels = channels.filter((c) => c.isOfferExpired());
      } else if (status === "in_progress") {
        // In progress means there is an order and it's not completed/cancelled
        channels = await NetworkListingChannel.find({
          _id: { $in: channels.map((c) => c._id) },
          order_id: { $ne: null },
        }).populate({
          path: "order_id",
          match: { status: { $nin: ["completed", "cancelled", "expired"] } },
        });
        channels = channels.filter((c) => c.order_id != null);
      } else {
        // Filter by historical offer status (accepted, declined)
        channels = channels.filter((c) =>
          c.offer_history.some((o) => o.status === status),
        );
      }
    }

    // Pagination
    const total = channels.length;
    const paginatedChannels = channels.slice(
      Number(offset),
      Number(offset) + Number(limit),
    );

    const response: ApiResponse<INetworkListingChannel[]> = {
      data: paginatedChannels.map((c) => c.toJSON?.() ?? c) as any,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    };

    res.json(response);
  } catch (err: any) {
    logger.error("Error fetching user channels", { error: err });
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch user channels", err));
    }
  }
};

/**
 * Get all channels for a listing (seller only)
 * GET /api/v1/networks/listings/:id/offers
 */
export const networks_listing_offers_get = async (
  req: Request<GetListingChannelsInput["params"], {}, {}>,
  res: Response<ApiResponse<INetworkListingChannel[]>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();

    const { id: listingId } = req.params;
    const userId = (req as any).user.dialist_id;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      throw new ValidationError("Invalid listing ID");
    }

    const listing = await NetworkListing.findById(listingId);
    if (!listing) throw new NotFoundError("Listing");

    // Must be seller
    if (String(listing.dialist_id) !== String(userId)) {
      throw new AuthorizationError("Only seller can view listing offers", {});
    }

    // Get all channels for this listing
    const channels = await NetworkListingChannel.find({
      listing_id: listingId,
    }).sort({ updatedAt: -1 });

    const response: ApiResponse<INetworkListingChannel[]> = {
      data: channels.map((c) => c.toJSON()) as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err: any) {
    logger.error("Error fetching listing channels", { error: err });
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch listing channels", err));
    }
  }
};
