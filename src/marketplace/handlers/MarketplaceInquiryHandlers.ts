/**
 * Inquiry Handlers
 *
 * Handle inquiries on listings - creates chat channels IMMEDIATELY
 * per the requirement that channels are created when buyer inquires.
 *
 * Marketplace: Channel is unique per (listing, buyer, seller)
 * Networks: Channel is unique per (buyer, seller) - reused across listings
 */

import mongoose from "mongoose";
import { Request, Response, NextFunction } from "express";
import { MarketplaceListing } from "../models/MarketplaceListing";
import { MarketplaceListingChannel } from "../models/MarketplaceListingChannel";
import { chatService } from "../../services/ChatService";
import { User } from "../../models/User";
import { ValidationError, NotFoundError } from "../../utils/errors";
import logger from "../../utils/logger";

interface InquiryRequest {
  message?: string;
}

/**
 * Create an inquiry on a Marketplace listing
 * POST /api/v1/marketplace/listings/:id/inquire
 *
 * This creates or retrieves a chat channel IMMEDIATELY and sends
 * the inquiry as a system message.
 */
export const marketplace_listing_inquire = async (
  req: Request<{ id: string }, {}, InquiryRequest>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) {
      throw new ValidationError("User not authenticated");
    }

    const buyerId = (req as any).user.dialist_id;
    const { id: listingId } = req.params;
    const { message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      throw new ValidationError("Invalid listing id");
    }

    // 1. Get listing
    const listing = await MarketplaceListing.findById(listingId);
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // 2. Validate - can't inquire on your own listing
    const sellerId = listing.dialist_id.toString();
    if (buyerId === sellerId) {
      throw new ValidationError("Cannot inquire on your own listing");
    }

    // 3. Check if channel already exists
    let channel = await MarketplaceListingChannel.findOne({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: sellerId,
    });

    let channelCreated = false;

    if (!channel) {
      // 4. Get buyer and seller details for snapshots
      const [buyer, seller] = await Promise.all([
        User.findById(buyerId),
        User.findById(sellerId),
      ]);

      if (!buyer || !seller) {
        throw new NotFoundError("User not found");
      }

      // 5. Create GetStream channel FIRST (real-time ready immediately)
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
          true, // Marketplace = listing unique
        );

      // 6. Create channel document in MongoDB
      channel = await MarketplaceListingChannel.create({
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: sellerId,
        getstream_channel_id: getstreamChannelId,
        created_from: "inquiry",
        buyer_snapshot: {
          _id: buyer._id,
          name: buyer.display_name || buyer.first_name || "Buyer",
          ...(buyer.avatar && { avatar: buyer.avatar }),
        },
        seller_snapshot: {
          _id: seller._id,
          name: seller.display_name || seller.first_name || "Seller",
          ...(seller.avatar && { avatar: seller.avatar }),
        },
        listing_snapshot: {
          brand: listing.brand || "Unknown",
          model: listing.model || "Unknown",
          reference: listing.reference || "Unknown",
          price: listing.price,
          ...(listing.condition && { condition: listing.condition }),
          ...(listing.thumbnail && { thumbnail: listing.thumbnail }),
        },
        status: "open",
        inquiries: [
          {
            sender_id: new mongoose.Types.ObjectId(buyerId),
            message: message || "Interested in this listing",
            createdAt: new Date(),
          },
        ],
        last_event_type: "inquiry",
        last_offer: null,
        order_id: null,
      });

      channelCreated = true;

      logger.info("Marketplace inquiry channel created", {
        channelId: channel._id,
        getstreamChannelId,
        listingId,
        buyerId,
        sellerId,
      });
    } else {
      // Channel exists - add inquiry to existing channel
      // Initialize inquiries array if undefined (for older channels)
      if (!channel.inquiries) {
        (channel as any).inquiries = [];
      }
      (channel as any).inquiries.push({
        sender_id: new mongoose.Types.ObjectId(buyerId),
        message: message || "Interested in this listing",
        createdAt: new Date(),
      });
      channel.last_event_type = "inquiry";
      await channel.save();
    }

    // 6. Send inquiry as system message in GetStream
    if (channel.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          channel.getstream_channel_id,
          {
            type: "inquiry",
            message:
              message || `Inquiry about ${listing.brand} ${listing.model}`,
          },
          buyerId,
        );
      } catch (chatError) {
        logger.warn("Failed to send inquiry message to Stream", { chatError });
      }
    }

    // 7. Create notification for seller
    try {
      // TODO: Replace with platform-specific notification service (marketplace)
      logger.debug(
        "[DEPRECATED] Notification creation disabled - use marketplace notification service",
        { sellerId, type: "new_inquiry" },
      );
      // await Notification.create({
      //   user_id: sellerId,
      //   type: "new_inquiry",
      //   title: "New Inquiry",
      //   body: `Someone is interested in your ${listing.brand} ${listing.model}`,
      //   data: {
      //     listing_id: listingId,
      //     channel_id: (channel._id as any).toString(),
      //     buyer_id: buyerId,
      //   },
      //   action_url: actionUrl,
      // });
    } catch (notifError) {
      logger.warn("Failed to create inquiry notification", { notifError });
    }

    res.status(channelCreated ? 201 : 200).json({
      data: {
        channel_id: (channel._id as any).toString(),
        getstream_channel_id: channel.getstream_channel_id,
        listing_id: listingId,
        seller_id: sellerId,
        created: channelCreated,
      },
      message: channelCreated
        ? "Inquiry sent and chat channel created"
        : "Inquiry added to existing conversation",
    });
  } catch (error: any) {
    next(error);
  }
};
