// src/networks/handlers/NetworksReservationHandlers.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

import { Order, IOrder } from "../../models/Order";

import { ApiResponse } from "../../types";
import {
  AppError,
  NotFoundError,
  ValidationError,
  MissingUserContextError,
  DatabaseError,
  AuthorizationError,
} from "../../utils/errors";
import { CreateReservationInput } from "../../validation/schemas";
import { transitionListingStatus } from "../../utils/listingStatusMachine";
import logger from "../../utils/logger";

import { Notification } from "../../models/Notification";
import { NetworkListingChannel } from "../../models/ListingChannel";
import { NetworkListing } from "../../models/Listings";

/**
 * Create a direct reservation (Buy Now)
 * POST /api/v1/networks/reservations
 */
export const networks_reservation_create = async (
  req: Request<{}, {}, CreateReservationInput["body"]>,
  res: Response<ApiResponse<IOrder>>,
  next: NextFunction
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!(req as any).user) {
      throw new MissingUserContextError();
    }

    if (!(req as any).user.isMerchant) {
      throw new AuthorizationError("Only approved merchants can reserve items on Networks", {});
    }

    const { listing_id, shipping_region } = req.body;
    const buyerId = (req as any).user.dialist_id;

    // 1. Find listing and lock it (SELECT FOR UPDATE equivalent in Mongoose is hard, 
    // so we use status check + transition within transaction)
    const listing = await NetworkListing.findById(listing_id).session(session);
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // 2. Validate listing status
    if (listing.status !== "active") {
      throw new ValidationError("Listing is no longer active and cannot be reserved");
    }

    if (String(listing.dialist_id) === String(buyerId)) {
      throw new ValidationError("Cannot reserve your own listing");
    }

    // 3. Find shipping cost for selected region
    const shippingOption = listing.shipping?.find(s => s.region === shipping_region);
    const shippingCost = shippingOption ? (shippingOption.shippingIncluded ? 0 : shippingOption.shippingCost) : 0;
    
    // Note: If shipping_region is International but not explicitly in options, 
    // we might need fallback or error. For now, assuming UI only sends valid regions.

    // 4. Create Order (the Reservation)
    const expiresAt = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes
    
    const order = await Order.create([{
      listing_type: "NetworkListing",
      listing_id: listing._id,
      listing_snapshot: {
        brand: listing.brand,
        model: listing.model,
        reference: listing.reference,
        condition: listing.condition,
        price: listing.price,
        thumbnail: listing.thumbnail,
        images: listing.images,
      },
      seller_snapshot: {
        _id: listing.author._id,
        display_name: listing.author.name,
        email: "", // User model email usually not in listing author snapshot
        avatar: listing.author.avatar,
      },
      buyer_id: buyerId,
      seller_id: listing.dialist_id,
      amount: (listing.price || 0) + shippingCost,
      status: "reserved",
      reserved_at: new Date(),
      reservation_expires_at: expiresAt,
      metadata: {
        shipping_region,
        shipping_cost: shippingCost,
        buy_type: "direct_buy",
      }
    }], { session });

    const createdOrder = order[0];

    // 5. Transition listing status
    await transitionListingStatus(listing, "reserved");

    // 6. Create/Update Channel (User-to-User)
    let channel = await NetworkListingChannel.findOne({
      $or: [
        { buyer_id: buyerId, seller_id: listing.dialist_id },
        { buyer_id: listing.dialist_id, seller_id: buyerId },
      ],
    }).session(session);

    if (channel) {
      channel.status = "open";
      channel.last_event_type = "order";
      channel.order_id = createdOrder._id as any;
      channel.listing_id = listing._id as any;
      await channel.save({ session });
    } else {
      // Create channel if it doesn't exist (though usually they inquired first)
      channel = await NetworkListingChannel.create([{
        listing_id: listing._id,
        buyer_id: buyerId,
        seller_id: listing.dialist_id,
        status: "open",
        created_from: "reservation",
        last_event_type: "order",
        buyer_snapshot: {
          _id: buyerId,
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
          thumbnail: listing.thumbnail,
        },
        order_id: createdOrder._id as any,
      }], { session }) as any;
    }

    // 7. Update Order with channel reference
    createdOrder.channel_id = channel!._id as any;
    createdOrder.channel_type = "NetworkListingChannel";
    await createdOrder.save({ session });

    await session.commitTransaction();

    logger.info("Listing reserved via Direct Buy", {
      orderId: createdOrder._id,
      listingId: listing._id,
      buyerId,
    });

    // Notify seller and buyer (non-critical)
    try {
      await Notification.create({
        user_id: listing.dialist_id,
        type: "item_reserved",
        title: "Your Item was Reserved!",
        body: `${(req as any).user.display_name} has reserved your ${listing.brand} ${listing.model}. Respond to their message now.`,
        data: {
          listing_id: listing._id.toString(),
          order_id: createdOrder._id.toString(),
        },
        action_url: `/networks/orders/${createdOrder._id}`,
      });
    } catch (notifErr) {
      logger.warn("Failed to create reservation notification", { notifErr });
    }

    res.status(201).json({
      data: createdOrder.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    await session.abortTransaction();
    console.error("Error creating reservation:", err);
    if (err instanceof AppError || err instanceof ValidationError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to create reservation", err));
    }
  } finally {
    session.endSession();
  }
};

/**
 * Get reservation/order summary
 * GET /api/v1/networks/reservations/:id
 */
export const networks_reservation_get = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<IOrder>>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).lean();
    
    if (!order) {
      throw new NotFoundError("Reservation not found");
    }

    res.json({
      data: order as any,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    next(err);
  }
};
