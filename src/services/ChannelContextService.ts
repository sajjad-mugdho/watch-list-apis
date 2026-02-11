/**
 * Channel Context Service
 *
 * Enriches GetStream chat channels with business context from MongoDB.
 * This service bridges the GetStream messaging layer with our domain data.
 *
 * Features:
 * - Lookup listing details for a channel
 * - Get active offer status
 * - Get order status and history
 * - Get reference check status
 * - Aggregate context for conversation list view
 */

import { Types } from "mongoose";
import { MarketplaceListing, NetworkListing } from "../models/Listings";
import { MarketplaceListingChannel } from "../models/MarketplaceListingChannel";
import { NetworkListingChannel } from "../models/ListingChannel";
import { Order } from "../models/Order";
import { Offer } from "../models/Offer";
import { OfferRevision } from "../models/OfferRevision";
import { chatService } from "./ChatService";
import logger from "../utils/logger";

// ============================================================
// Types
// ============================================================

export type Platform = "marketplace" | "networks";

export interface ChannelParty {
  id: string;
  displayName: string;
  avatar?: string;
  role: "buyer" | "seller";
}

export interface ListingContext {
  id: string;
  brand?: string;
  model?: string;
  reference?: string;
  price?: number;
  currency: string;
  condition?: string;
  thumbnail?: string;
  status: string;
}

export interface OfferContext {
  id: string;
  state: string;
  amount: number;
  currency: string;
  expiresAt: Date;
  revisionNumber: number;
  lastUpdatedBy: string;
  isExpired: boolean;
}

export interface OrderContext {
  id: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: Date;
  reservedAt?: Date;
  paidAt?: Date;
  shippedAt?: Date;
  completedAt?: Date;
}

export interface ReferenceCheckContext {
  id: string;
  status: string;
  targetId: string;
  targetName?: string;
  responseCount: number;
  vouchCount: number;
  totalVouchWeight: number;
}

export interface ChannelContext {
  channelId: string;
  getstreamChannelId: string;
  platform: Platform;
  parties: ChannelParty[];
  listing?: ListingContext;
  activeOffer?: OfferContext;
  order?: OrderContext;
  referenceCheck?: ReferenceCheckContext;
  lastActivity: Date;
  createdAt: Date;
}

export interface SharedMediaItem {
  id: string;
  type: string;
  url: string;
  thumbUrl?: string;
  title?: string;
  createdAt: Date;
}

export interface SharedMediaResponse {
  data: SharedMediaItem[];
  next?: string;
}

export interface ConversationListItem {
  channelId: string;
  getstreamChannelId: string;
  platform: Platform;
  otherParty: ChannelParty;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: number;
  listing?: {
    title: string;
    thumbnail?: string;
    price?: number;
  } | undefined;
  status: {
    type: "offer" | "order" | "inquiry" | "reference_check";
    label: string;
    state?: string;
  };
}

// ============================================================
// ChannelContextService
// ============================================================

export class ChannelContextService {
  /**
   * Get full context for a channel
   */
  async getChannelContext(
    channelId: string,
    platform: Platform
  ): Promise<ChannelContext | null> {
    const ChannelModel =
      platform === "marketplace" ? MarketplaceListingChannel : NetworkListingChannel;

    const channel = await ChannelModel.findById(channelId)
      .populate("buyer_id", "_id display_name avatar")
      .populate("seller_id", "_id display_name avatar");

    if (!channel) {
      logger.warn("[ChannelContextService] Channel not found", { channelId, platform });
      return null;
    }

    // Build base context
    const channelDoc = channel as any;
    const context: ChannelContext = {
      channelId: channelDoc._id.toString(),
      getstreamChannelId: channelDoc.getstream_channel_id || "",
      platform,
      parties: this.buildParties(channelDoc),
      lastActivity: channelDoc.updatedAt || channelDoc.createdAt,
      createdAt: channelDoc.createdAt,
    };

    // Add listing context
    const listingContext = await this.getListingContext(
      channelDoc.listing_id.toString(),
      platform
    );
    if (listingContext) {
      context.listing = listingContext;
    }

    // Add active offer context
    const offerContext = await this.getActiveOfferContext(
      channelDoc.listing_id.toString(),
      channelDoc.buyer_id._id?.toString() || channelDoc.buyer_id.toString()
    );
    if (offerContext) {
      context.activeOffer = offerContext;
    }

    // Add order context if exists
    if (channelDoc.order_id) {
      const orderContext = await this.getOrderContext(
        channelDoc.order_id.toString()
      );
      if (orderContext) {
        context.order = orderContext;
      }
    }

    return context;
  }

  /**
   * Get enriched conversation list for a user
   */
  async getConversationsForUser(
    userId: string,
    platform: Platform,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ConversationListItem[]> {
    const { limit = 20, offset = 0 } = options;

    const ChannelModel =
      platform === "marketplace" ? MarketplaceListingChannel : NetworkListingChannel;

    // Find channels where user is buyer or seller
    const channels = await ChannelModel.find({
      $or: [
        { buyer_id: new Types.ObjectId(userId) },
        { seller_id: new Types.ObjectId(userId) },
      ],
    })
      .populate("buyer_id", "_id display_name avatar")
      .populate("seller_id", "_id display_name avatar")
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // Get GetStream unread counts
    const unreadCounts = await this.getUnreadCountsMap(userId);

    // Build conversation items
    const conversations: ConversationListItem[] = [];

    for (const channel of channels) {
      const item = await this.buildConversationItem(
        channel,
        userId,
        platform,
        unreadCounts
      );
      if (item) {
        conversations.push(item);
      }
    }

    return conversations;
  }

  /**
   * Get context for multiple channels (batch)
   */
  async batchGetChannelContext(
    channelIds: string[],
    platform: Platform
  ): Promise<Map<string, ChannelContext>> {
    const results = new Map<string, ChannelContext>();

    // Process in parallel with concurrency limit
    const batchSize = 10;
    for (let i = 0; i < channelIds.length; i += batchSize) {
      const batch = channelIds.slice(i, i + batchSize);
      const contexts = await Promise.all(
        batch.map((id) => this.getChannelContext(id, platform))
      );

      contexts.forEach((ctx, idx) => {
        if (ctx) {
          results.set(batch[idx], ctx);
        }
      });
    }

    return results;
  }

  /**
   * Search conversations by listing or party name
   */
  async searchConversations(
    userId: string,
    query: string,
    platform: Platform
  ): Promise<ConversationListItem[]> {
    const ChannelModel =
      platform === "marketplace" ? MarketplaceListingChannel : NetworkListingChannel;

    // Find all user's channels first
    const channels = await ChannelModel.find({
      $or: [
        { buyer_id: new Types.ObjectId(userId) },
        { seller_id: new Types.ObjectId(userId) },
      ],
    })
      .populate("buyer_id", "_id display_name avatar")
      .populate("seller_id", "_id display_name avatar")
      .lean();

    const lowerQuery = query.toLowerCase();
    const unreadCounts = await this.getUnreadCountsMap(userId);

    const results: ConversationListItem[] = [];

    for (const channel of channels) {
      const ch = channel as any;
      // Check if other party name matches
      const otherParty =
        (ch.buyer_id._id?.toString() || ch.buyer_id.toString()) === userId
          ? ch.seller_id
          : ch.buyer_id;

      const nameMatches = otherParty.display_name
        ?.toLowerCase()
        .includes(lowerQuery);

      // Get listing to check title
      const listing = await this.getListingContext(
        channel.listing_id.toString(),
        platform
      );
      const listingMatches =
        listing?.brand?.toLowerCase().includes(lowerQuery) ||
        listing?.model?.toLowerCase().includes(lowerQuery) ||
        listing?.reference?.toLowerCase().includes(lowerQuery);

      if (nameMatches || listingMatches) {
        const item = await this.buildConversationItem(
          channel,
          userId,
          platform,
          unreadCounts
        );
        if (item) {
          results.push(item);
        }
      }
    }

    return results;
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private buildParties(channel: any): ChannelParty[] {
    return [
      {
        id: channel.buyer_id._id.toString(),
        displayName: channel.buyer_id.display_name || "Buyer",
        avatar: channel.buyer_id.avatar,
        role: "buyer",
      },
      {
        id: channel.seller_id._id.toString(),
        displayName: channel.seller_id.display_name || "Seller",
        avatar: channel.seller_id.avatar,
        role: "seller",
      },
    ];
  }

  private async getListingContext(
    listingId: string,
    platform: Platform
  ): Promise<ListingContext | null> {
    let listing: any;
    if (platform === "marketplace") {
      listing = await MarketplaceListing.findById(listingId).lean();
    } else {
      listing = await NetworkListing.findById(listingId).lean();
    }
    if (!listing) return null;

    return {
      id: listing._id.toString(),
      brand: listing.watch_snapshot?.brand || listing.brand,
      model: listing.watch_snapshot?.model || listing.model,
      reference: listing.watch_snapshot?.reference || listing.reference,
      price: listing.price,
      currency: listing.currency || "USD",
      condition: listing.condition,
      thumbnail:
        typeof listing.thumbnail === "string"
          ? listing.thumbnail
          : listing.images?.[0],
      status: listing.status,
    };
  }

  private async getActiveOfferContext(
    listingId: string,
    buyerId: string
  ): Promise<OfferContext | null> {
    const offer = await Offer.findActiveByListingAndBuyer(listingId, buyerId);
    if (!offer) return null;

    const revision = await OfferRevision.getLatestRevision(offer._id.toString());
    if (!revision) return null;

    return {
      id: offer._id.toString(),
      state: offer.state,
      amount: revision.amount,
      currency: revision.currency,
      expiresAt: offer.expires_at,
      revisionNumber: revision.revision_number,
      lastUpdatedBy: revision.created_by.toString(),
      isExpired: offer.isExpired(),
    };
  }

  private async getOrderContext(orderId: string): Promise<OrderContext | null> {
    const order = await Order.findById(orderId).lean();
    if (!order) return null;

    const result: OrderContext = {
      id: order._id.toString(),
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      createdAt: order.createdAt,
    };
    if (order.reserved_at) result.reservedAt = order.reserved_at;
    if (order.paid_at) result.paidAt = order.paid_at;
    if (order.shipped_at) result.shippedAt = order.shipped_at;
    if (order.completed_at) result.completedAt = order.completed_at;
    return result;
  }

  private async getUnreadCountsMap(
    userId: string
  ): Promise<Map<string, number>> {
    try {
      const { channels } = await chatService.getUnreadCounts(userId);
      return new Map(Object.entries(channels));
    } catch (error) {
      logger.warn("[ChannelContextService] Failed to get unread counts", {
        userId,
        error,
      });
      return new Map();
    }
  }

  private async buildConversationItem(
    channel: any,
    userId: string,
    platform: Platform,
    unreadCounts: Map<string, number>
  ): Promise<ConversationListItem | null> {
    try {
      const getstreamChannelId = channel.getstream_channel_id || "";

      // Determine other party
      const isBuyer = channel.buyer_id._id.toString() === userId;
      const otherPartyData = isBuyer ? channel.seller_id : channel.buyer_id;

      // Get listing info
      const listing = await this.getListingContext(
        channel.listing_id.toString(),
        platform
      );

      // Determine status
      let status: ConversationListItem["status"];

      if (channel.order_id) {
        const order = await Order.findById(channel.order_id)
          .select("status")
          .lean();
        const orderStatus: { type: "order"; label: string; state?: string } = {
          type: "order",
          label: order ? this.orderStatusLabel(order.status) : "Order",
        };
        if (order?.status) {
          orderStatus.state = order.status;
        }
        status = orderStatus;
      } else {
        const offer = await Offer.findActiveByListingAndBuyer(
          channel.listing_id.toString(),
          channel.buyer_id._id.toString()
        );

        if (offer) {
          status = {
            type: "offer",
            label: this.offerStateLabel(offer.state),
            state: offer.state,
          };
        } else {
          status = {
            type: "inquiry",
            label: "Inquiry",
          };
        }
      }

      return {
        channelId: channel._id.toString(),
        getstreamChannelId,
        platform,
        otherParty: {
          id: otherPartyData._id.toString(),
          displayName: otherPartyData.display_name || "User",
          avatar: otherPartyData.avatar,
          role: isBuyer ? "seller" : "buyer",
        },
        unreadCount: unreadCounts.get(getstreamChannelId) || 0,
        listing: listing
          ? (() => {
              const listingInfo: { title: string; thumbnail?: string; price?: number } = {
                title: [listing.brand, listing.model].filter(Boolean).join(" "),
              };
              if (listing.thumbnail) listingInfo.thumbnail = listing.thumbnail;
              if (listing.price !== undefined) listingInfo.price = listing.price;
              return listingInfo;
            })()
          : undefined,
        status,
      };
    } catch (error) {
      logger.error("[ChannelContextService] Failed to build conversation item", {
        channelId: channel._id?.toString(),
        error,
      });
      return null;
    }
  }

  private offerStateLabel(state: string): string {
    const labels: Record<string, string> = {
      CREATED: "Offer Pending",
      COUNTERED: "Counter Offer",
      ACCEPTED: "Offer Accepted",
      DECLINED: "Offer Declined",
      EXPIRED: "Offer Expired",
    };
    return labels[state] || "Offer";
  }

  private orderStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: "Order Pending",
      reserved: "Reserved",
      paid: "Paid",
      shipped: "Shipped",
      delivered: "Delivered",
      completed: "Completed",
      cancelled: "Cancelled",
      refunded: "Refunded",
    };
    return labels[status] || "Order";
  }

  /**
   * Get shared media for a channel using GetStream search
   */
  async getSharedMedia(
    getstreamChannelId: string,
    options: { type?: string; limit?: number; next?: string } = {}
  ): Promise<SharedMediaResponse> {
    const { type = "all", limit = 20, next } = options;

    const messageFilter: any = { "attachments.0": { $exists: true } };
    if (type !== "all") {
      messageFilter["attachments.type"] = type;
    }

    const response = await chatService.searchMessages(
      { cid: getstreamChannelId },
      messageFilter,
      limit,
      next
    );

    const media: SharedMediaItem[] = response.results.flatMap((r: any) =>
      (r.message.attachments || []).map((att: any, idx: number) => ({
        id: `${r.message.id}_${idx}`,
        type: att.type,
        url: att.asset_url || att.image_url || att.og_scrape_url || "",
        thumbUrl: att.thumb_url,
        title: att.title,
        createdAt: new Date(r.message.created_at),
      }))
    );

    return {
      data: media,
      next: response.next,
    };
  }
}

// Singleton instance
export const channelContextService = new ChannelContextService();
