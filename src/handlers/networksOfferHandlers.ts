import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import {
  NetworkListingChannel,
  INetworkListingChannel,
} from "../models/ListingChannel";
import { NetworkListing, INetworkListing } from "../models/Listings";
import {
  AppError,
  NotFoundError,
  ValidationError,
  AuthorizationError,
  MissingUserContextError,
  DatabaseError,
} from "../utils/errors";
import { ApiResponse } from "../types";
import {
  SendOfferInput,
  CounterOfferInput,
  ChannelActionInput,
  GetUserChannelsInput,
  GetListingChannelsInput,
} from "../validation/schemas";
import { chatService } from "../services/ChatService";
import { Notification } from "../models/Notification";
import logger from "../utils/logger";

// ----------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------

function validateOfferEligibility(
  listing: INetworkListing,
  buyerId: string,
  amount: number
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
  newAmount: number
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
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new MissingUserContextError();

    const { id: listingId } = req.params;
    const { amount, message } = req.body;
    const buyerId = req.user.dialist_id;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      throw new ValidationError("Invalid listing ID");
    }

    const listing = await NetworkListing.findById(listingId);
    if (!listing) throw new NotFoundError("Listing");

    validateOfferEligibility(listing, buyerId, amount);

    // Check for existing channel
    // For Networks, channels are unique per participant pair (User to User)
    const sellerId = listing.dialist_id.toString();
    const existingChannel = await NetworkListingChannel.findOne({
      $or: [
        { buyer_id: buyerId, seller_id: sellerId },
        { buyer_id: sellerId, seller_id: buyerId }
      ]
    });

    if (existingChannel) {
      if (existingChannel.status === "closed") {
        throw new ValidationError("Channel is closed");
      }

      if (existingChannel.hasActiveOffer()) {
        throw new ValidationError(
          "An active offer already exists on this channel"
        );
      }

      existingChannel.supersedeLastOffer();

      existingChannel.last_offer = {
        sender_id: buyerId as any,
        amount,
        message: message || null,
        offer_type: "initial",
        status: "sent",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        createdAt: new Date(),
      };
      // For reused channels, update the listing snapshot to the current inquiry
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
      existingChannel.last_event_type = "offer";

      await existingChannel.save();

      // Send system message to Stream Chat channel if it exists
      if (existingChannel.getstream_channel_id) {
        try {
          await chatService.sendSystemMessage(
            existingChannel.getstream_channel_id,
            { type: "offer", amount, offer_id: (existingChannel._id as any).toString() },
            buyerId
          );
        } catch (chatError) {
          logger.warn("Failed to send networks offer message to Stream", { chatError });
        }
      }

      // Create in-app notification for seller
      try {
        await Notification.create({
          user_id: listing.dialist_id,
          type: "offer_received",
          title: "New Offer Received",
          body: `You received an offer of $${amount.toLocaleString()} for ${listing.brand} ${listing.model}`,
          data: {
            listing_id: listingId,
            channel_id: (existingChannel._id as any).toString(),
            amount,
          },
          action_url: `/networks/offers/${(existingChannel._id as any).toString()}`,
        });
      } catch (notifError) {
        logger.warn("Failed to create networks offer notification", { notifError });
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
        name: req.user.display_name,
        avatar: req.user.display_avatar,
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
      last_offer: {
        sender_id: buyerId as any,
        amount,
        message: message || null,
        offer_type: "initial",
        status: "sent",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
      order: null,
    });

    // Create Stream Chat channel for this conversation
    try {
      const { channelId: getstreamChannelId } =
        await chatService.getOrCreateChannel(buyerId, sellerId, {
          listing_id: listingId,
          listing_title: `${listing.brand} ${listing.model}`,
          listing_price: listing.price,
          ...(listing.thumbnail && { listing_thumbnail: listing.thumbnail }),
        }, false); // listingUnique = false for Networks

      // Store the Stream channel ID in our channel document
      channel.getstream_channel_id = getstreamChannelId;
      await channel.save();

      // Send initial offer as system message
      await chatService.sendSystemMessage(
        getstreamChannelId,
        { type: "offer", amount, offer_id: (channel._id as any).toString() },
        buyerId
      );

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

    // Create in-app notification for seller
    try {
      await Notification.create({
        user_id: listing.dialist_id,
        type: "offer_received",
        title: "New Offer Received",
        body: `You received an offer of $${amount.toLocaleString()} for ${listing.brand} ${listing.model}`,
        data: {
          listing_id: listingId,
          channel_id: (channel._id as any).toString(),
          amount,
        },
        action_url: `/networks/offers/${(channel._id as any).toString()}`,
      });
    } catch (notifError) {
      logger.warn("Failed to create networks offer notification", { notifError });
    }

    const response: ApiResponse<INetworkListingChannel> = {
      data: channel.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(201).json(response);
  } catch (err) {
    console.error("Error sending offer:", err);
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
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new MissingUserContextError();

    const { id: channelId } = req.params;
    const { amount, message } = req.body;

    const dialist_id = req.user.dialist_id;
    if (!mongoose.Types.ObjectId.isValid(req.user.dialist_id)) {
      throw new ValidationError("Invalid dialist_id");
    }

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      throw new ValidationError("Invalid channel ID");
    }

    const channel = await NetworkListingChannel.findById(channelId);
    if (!channel) throw new NotFoundError("Channel");

    if (channel.status === "closed") {
      throw new ValidationError("Channel is closed");
    }

    // Must be member of channel
    const role = channel.getUserRole(dialist_id);
    if (!role) {
      throw new AuthorizationError(
        "Not authorized to counter on this channel",
        {}
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

    // Supersede last offer
    channel.supersedeLastOffer();

    // Add new counter offer
    channel.last_offer = {
      sender_id: dialist_id as any,
      amount,
      message: message || null,
      offer_type: "counter",
      status: "sent",
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      createdAt: new Date(),
    };
    channel.last_event_type = "offer";

    await channel.save();

    // Send system message to Stream Chat channel if it exists
    if (channel.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          channel.getstream_channel_id,
          { type: "counter_offer", amount, offer_id: (channel._id as any).toString() },
          dialist_id
        );
      } catch (chatError) {
        logger.warn("Failed to send networks counter offer message to Stream", { chatError });
      }
    }

    // Create in-app notification for recipient
    try {
      const recipientId = role === "buyer" ? channel.seller_id : channel.buyer_id;
      await Notification.create({
        user_id: recipientId,
        type: "counter_offer",
        title: "Counter Offer Received",
        body: `You received a counter offer of $${amount.toLocaleString()} for ${channel.listing_snapshot.brand} ${channel.listing_snapshot.model}`,
        data: {
          listing_id: channel.listing_id.toString(),
          channel_id: (channel._id as any).toString(),
          amount,
        },
        action_url: `/networks/offers/${(channel._id as any).toString()}`,
      });
    } catch (notifError) {
      logger.warn("Failed to create networks counter offer notification", { notifError });
    }

    const response: ApiResponse<INetworkListingChannel> = {
      data: channel.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(201).json(response);
  } catch (err) {
    console.error("Error countering offer:", err);
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
  next: NextFunction
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.user) throw new MissingUserContextError();

    const { id: channelId } = req.params;
    const userId = req.user.dialist_id;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      throw new ValidationError("Invalid channel ID");
    }

    const channel = await NetworkListingChannel.findById(channelId).session(
      session
    );
    if (!channel) throw new NotFoundError("Channel");

    if (channel.status === "closed") {
      throw new ValidationError("Channel is closed");
    }

    // Must have active offer
    if (!channel.hasActiveOffer()) {
      throw new ValidationError("No active offer to accept");
    }

    const lastOffer = channel.last_offer;
    if (!lastOffer) throw new ValidationError("No offer to accept");

    // Must be a member of the channel
    const userRole = channel.getUserRole(userId);
    if (!userRole) {
      throw new AuthorizationError("Not authorized to act on this channel", {});
    }

    // Cannot accept own offer
    if (String(lastOffer.sender_id) === String(userId)) {
      throw new ValidationError("Cannot accept your own offer");
    }

    // Get listing
    const listing = await NetworkListing.findById(channel.listing_id).session(
      session
    );
    if (!listing || listing.status !== "active") {
      throw new ValidationError("Listing is not available");
    }

    // Update offer history - add accepted offer to history
    const historyEntry: any = {
      sender_id: lastOffer.sender_id,
      amount: lastOffer.amount,
      message: lastOffer.message,
      offer_type: lastOffer.offer_type,
      status: "accepted",
      expiresAt: lastOffer.expiresAt,
      createdAt: lastOffer.createdAt,
    };
    if (lastOffer._id) {
      historyEntry._id = lastOffer._id;
    }
    channel.offer_history.push(historyEntry);

    // Update last_offer in-place to show accepted status
    const updatedOffer: any = {
      sender_id: lastOffer.sender_id,
      amount: lastOffer.amount,
      message: lastOffer.message,
      offer_type: lastOffer.offer_type,
      status: "accepted",
      expiresAt: lastOffer.expiresAt,
      createdAt: lastOffer.createdAt,
    };
    if (lastOffer._id) {
      updatedOffer._id = lastOffer._id;
    }
    channel.last_offer = updatedOffer;

    // TODO: Create Order document separately
    // channel.order = {
    //   from_offer_id: lastOffer._id! as any,
    //   amount: lastOffer.amount,
    //   buyer_id: channel.buyer_id,
    //   seller_id: channel.seller_id,
    //   status: "pending",
    //   createdAt: new Date(),
    // };
    channel.last_event_type = "order";

    await channel.save({ session });

    // Update listing status to reserved
    // TODO: Use status transition method
    listing.status = "reserved";
    // TODO: Remove deprecated listing.order
    // listing.order = {
    //   channel_id: channel._id as any,
    //   buyer_id: channel.buyer_id,
    //   buyer_name: channel.buyer_snapshot.name,
    //   reserved_at: new Date(),
    // };

    await listing.save({ session });

    // Send system message to Stream Chat channel if it exists
    if (channel.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          channel.getstream_channel_id,
          { 
            type: "offer_accepted", 
            amount: lastOffer.amount, 
            offer_id: (channel._id as any).toString() 
          },
          userId
        );
      } catch (chatError) {
        logger.warn("Failed to send networks offer accepted message to Stream", { chatError });
      }
    }

    // Create in-app notification for the offer sender
    try {
      await Notification.create({
        user_id: lastOffer.sender_id,
        type: "offer_accepted",
        title: "Offer Accepted!",
        body: `Your offer of $${lastOffer.amount.toLocaleString()} for ${channel.listing_snapshot.brand} ${channel.listing_snapshot.model} was accepted!`,
        data: {
          listing_id: channel.listing_id.toString(),
          channel_id: (channel._id as any).toString(),
          amount: lastOffer.amount,
        },
        action_url: `/networks/offers/${(channel._id as any).toString()}`,
      });
    } catch (notifError) {
      logger.warn("Failed to create networks offer accepted notification", { notifError });
    }

    await session.commitTransaction();

    const response: ApiResponse<INetworkListingChannel> = {
      data: channel.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err) {
    await session.abortTransaction();
    console.error("Error accepting offer:", err);
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to accept offer", err));
    }
  } finally {
    session.endSession();
  }
};

/**
 * Reject/decline an offer
 * POST /api/v1/networks/offers/:id/reject
 */
export const networks_offer_reject = async (
  req: Request<ChannelActionInput["params"], {}, {}>,
  res: Response<ApiResponse<INetworkListingChannel>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new MissingUserContextError();

    const { id: channelId } = req.params;
    const userId = req.user.dialist_id;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      throw new ValidationError("Invalid channel ID");
    }

    const channel = await NetworkListingChannel.findById(channelId);
    if (!channel) throw new NotFoundError("Channel");

    // Must be member of channel
    const role = channel.getUserRole(userId);
    if (!role) {
      throw new AuthorizationError("Not authorized to act on this channel", {});
    }

    // Must have active offer
    if (!channel.hasActiveOffer()) {
      throw new ValidationError("No active offer to reject");
    }

    const lastOffer = channel.last_offer;
    if (!lastOffer) throw new ValidationError("No offer to reject");

    // Cannot reject own offer
    if (String(lastOffer.sender_id) === String(userId)) {
      throw new ValidationError("Cannot reject your own offer");
    }

    // Resolve offer as declined
    await channel.resolveLastOffer("declined");

    // Send system message to Stream Chat channel if it exists
    if (channel.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          channel.getstream_channel_id,
          { 
            type: "offer_rejected", 
            offer_id: (channel._id as any).toString() 
          },
          userId
        );
      } catch (chatError) {
        logger.warn("Failed to send networks offer rejected message to Stream", { chatError });
      }
    }

    // Create in-app notification for the offer sender
    try {
      await Notification.create({
        user_id: lastOffer.sender_id,
        type: "offer_rejected",
        title: "Offer Declined",
        body: `Your offer for ${channel.listing_snapshot.brand} ${channel.listing_snapshot.model} was declined.`,
        data: {
          listing_id: channel.listing_id.toString(),
          channel_id: (channel._id as any).toString(),
        },
        action_url: `/networks/offers/${(channel._id as any).toString()}`,
      });
    } catch (notifError) {
      logger.warn("Failed to create networks offer rejected notification", { notifError });
    }

    const response: ApiResponse<INetworkListingChannel> = {
      data: channel.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err) {
    console.error("Error rejecting offer:", err);
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to reject offer", err));
    }
  }
};

/**
 * Get channel details
 * GET /api/v1/networks/offers/:id
 */
export const networks_offer_get = async (
  req: Request<ChannelActionInput["params"], {}, {}>,
  res: Response<ApiResponse<INetworkListingChannel & { role: string }>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new MissingUserContextError();

    const { id: channelId } = req.params;
    const userId = req.user.dialist_id;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      throw new ValidationError("Invalid channel ID");
    }

    const channel = await NetworkListingChannel.findById(channelId);
    if (!channel) throw new NotFoundError("Channel");

    // Must be member
    const role = channel.getUserRole(userId);
    if (!role) {
      throw new AuthorizationError("Not authorized to view this channel", {});
    }

    const response: ApiResponse<INetworkListingChannel & { role: string }> = {
      data: {
        ...(channel.toJSON() as any),
        role,
      } as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err) {
    console.error("Error fetching channel:", err);
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch channel", err));
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
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new MissingUserContextError();

    const userId = req.user.dialist_id;
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
      } else {
        // Filter by historical offer status
        channels = channels.filter((c) =>
          c.offer_history.some((o) => o.status === status)
        );
      }
    }

    // Pagination
    const total = channels.length;
    const paginatedChannels = channels.slice(
      Number(offset),
      Number(offset) + Number(limit)
    );

    const response: ApiResponse<INetworkListingChannel[]> = {
      data: paginatedChannels.map((c) => c.toJSON()) as any,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    };

    res.json(response);
  } catch (err) {
    console.error("Error fetching user channels:", err);
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
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new MissingUserContextError();

    const { id: listingId } = req.params;
    const userId = req.user.dialist_id;

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
  } catch (err) {
    console.error("Error fetching listing channels:", err);
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch listing channels", err));
    }
  }
};
