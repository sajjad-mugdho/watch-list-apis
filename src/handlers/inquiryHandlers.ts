/**
 * Inquiry Handlers
 *
 * Handle inquiries on listings - creates chat channels IMMEDIATELY
 * per the requirement that channels are created when buyer inquires.
 *
 * Marketplace: Channel is unique per (listing, buyer, seller)
 * Networks: Channel is unique per (buyer, seller) - reused across listings
 */

import { Request, Response, NextFunction } from "express";
import { MarketplaceListing, NetworkListing } from "../models/Listings";
import { MarketplaceListingChannel } from "../models/MarketplaceListingChannel";
import { NetworkListingChannel } from "../models/ListingChannel";
import { chatService } from "../services/ChatService";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { ValidationError, NotFoundError } from "../utils/errors";
import logger from "../utils/logger";

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
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError("User not authenticated");
    }

    const { id: listingId } = req.params;
    const { message } = req.body;
    const buyerId = req.user.dialist_id;

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
      const { channelId: getstreamChannelId } = await chatService.getOrCreateChannel(
        buyerId,
        sellerId,
        {
          listing_id: listingId,
          listing_title: `${listing.brand} ${listing.model}`,
          listing_price: listing.price,
          ...(listing.thumbnail && { listing_thumbnail: listing.thumbnail }),
        },
        true // Marketplace = listing unique
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
            sender_id: buyer._id as any,
            message: message || "Interested in this listing",
            createdAt: new Date(),
          },
        ],
        last_event_type: "inquiry",
        last_offer: null,
        order: null,
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
        sender_id: buyerId,
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
            message: message || `Inquiry about ${listing.brand} ${listing.model}`,
          },
          buyerId
        );
      } catch (chatError) {
        logger.warn("Failed to send inquiry message to Stream", { chatError });
      }
    }

    // 7. Create notification for seller
    try {
      await Notification.create({
        user_id: sellerId,
        type: "new_inquiry",
        title: "New Inquiry",
        body: `Someone is interested in your ${listing.brand} ${listing.model}`,
        data: {
          listing_id: listingId,
          channel_id: (channel._id as any).toString(),
          buyer_id: buyerId,
        },
        action_url: `/chat/${channel.getstream_channel_id}`,
      });
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
  } catch (error) {
    next(error);
  }
};

/**
 * Create an inquiry on a Networks listing
 * POST /api/v1/networks/listings/:id/inquire
 *
 * For Networks, channels are USER-TO-USER unique, not listing unique.
 * If a channel between these two users already exists, it is REUSED.
 */
export const networks_listing_inquire = async (
  req: Request<{ id: string }, {}, InquiryRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError("User not authenticated");
    }

    const { id: listingId } = req.params;
    const { message } = req.body;
    const buyerId = req.user.dialist_id;

    // 1. Get listing
    const listing = await NetworkListing.findById(listingId);
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // 2. Validate - can't inquire on your own listing
    const sellerId = listing.dialist_id.toString();
    if (buyerId === sellerId) {
      throw new ValidationError("Cannot inquire on your own listing");
    }

    // 3. Check if USER-TO-USER channel already exists (not listing specific)
    let channel = await NetworkListingChannel.findOne({
      $or: [
        { buyer_id: buyerId, seller_id: sellerId },
        { buyer_id: sellerId, seller_id: buyerId },
      ],
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
      const { channelId: getstreamChannelId } = await chatService.getOrCreateChannel(
        buyerId,
        sellerId,
        {
          listing_id: listingId,
          listing_title: `${listing.brand} ${listing.model}`,
          listing_price: listing.price,
          ...(listing.thumbnail && { listing_thumbnail: listing.thumbnail }),
        },
        false // Networks = user unique, NOT listing unique
      );

      // 6. Create channel document in MongoDB
      channel = await NetworkListingChannel.create({
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
            sender_id: buyer._id as any,
            message: message || "Interested in this listing",
            createdAt: new Date(),
          },
        ],
        last_event_type: "inquiry",
        last_offer: null,
        order: null,
      });

      channelCreated = true;

      logger.info("Networks inquiry channel created", {
        channelId: channel._id,
        getstreamChannelId,
        listingId,
        buyerId,
        sellerId,
      });
    } else {
      // Channel exists - update listing context and add inquiry
      channel.listing_id = listingId as any;
      channel.listing_snapshot = {
        brand: listing.brand || "Unknown",
        model: listing.model || "Unknown",
        reference: listing.reference || "Unknown",
        price: listing.price,
        ...(listing.condition && { condition: listing.condition }),
        ...(listing.thumbnail && { thumbnail: listing.thumbnail }),
      };
      // Initialize inquiries array if undefined (for older channels)
      if (!channel.inquiries) {
        (channel as any).inquiries = [];
      }
      (channel as any).inquiries.push({
        sender_id: buyerId,
        message: message || "Interested in this listing",
        createdAt: new Date(),
      });
      channel.last_event_type = "inquiry";
      await channel.save();

      // Update the GetStream channel metadata for the new listing context
      if (channel.getstream_channel_id) {
        try {
          await chatService.ensureConnected();
          const client = chatService.getClient();
          const streamChannel = client.channel("messaging", channel.getstream_channel_id);
          await streamChannel.updatePartial({
            set: {
              listing_id: listingId,
              listing_title: `${listing.brand} ${listing.model}`,
              listing_price: listing.price,
              ...(listing.thumbnail && { listing_thumbnail: listing.thumbnail }),
            } as any,
          });
        } catch (updateError) {
          logger.warn("Failed to update Stream channel metadata", { updateError });
        }
      }
    }

    // 6. Send inquiry as system message in GetStream
    if (channel.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          channel.getstream_channel_id,
          {
            type: "inquiry",
            message: message || `Inquiry about ${listing.brand} ${listing.model}`,
          },
          buyerId
        );
      } catch (chatError) {
        logger.warn("Failed to send inquiry message to Stream", { chatError });
      }
    }

    // 7. Create notification for seller
    try {
      await Notification.create({
        user_id: sellerId,
        type: "new_inquiry",
        title: "New Inquiry",
        body: `${(await User.findById(buyerId))?.display_name || "Someone"} is interested in your ${listing.brand} ${listing.model}`,
        data: {
          listing_id: listingId,
          channel_id: (channel._id as any).toString(),
          buyer_id: buyerId,
        },
        action_url: `/chat/${channel.getstream_channel_id}`,
      });
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
        reused: !channelCreated,
      },
      message: channelCreated
        ? "Inquiry sent and chat channel created"
        : "Inquiry added to existing conversation with this user",
    });
  } catch (error) {
    next(error);
  }
};
