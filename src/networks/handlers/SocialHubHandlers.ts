// src/networks/handlers/SocialHubHandlers.ts
import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import {
  MissingUserContextError,
  ValidationError,
  NotFoundError,
} from "../../utils/errors";
import { ChatMessage } from "../../models/ChatMessage";
import { SocialGroup } from "../models/SocialGroup";
import { SocialGroupMember } from "../models/SocialGroupMember";
import { User } from "../../models/User";
import { NetworkListingChannel } from "../models/NetworkListingChannel";
import { ReferenceCheck } from "../../models/ReferenceCheck";
import { Order } from "../../models/Order";
import { Vouch } from "../../models/Vouch";
import { chatService } from "../../services/ChatService";
import {
  GetSocialInboxInput,
  SearchSocialInput,
} from "../../validation/schemas";
import mongoose from "mongoose";

/**
 * Social hub status summary for header/navigation bootstrap.
 * GET /api/v1/networks/social/status
 */
export const social_status_get = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;

    const user = await User.findById(userId)
      .select("display_name avatar networks_last_accessed")
      .lean();

    await chatService.ensureConnected();
    const client = chatService.getClient();
    const channels = await client.queryChannels(
      {
        members: { $in: [String(userId)] },
        platform: "networks",
      } as any,
      [{ last_message_at: -1 }],
      {
        limit: 100,
        offset: 0,
        watch: false,
        presence: false,
      },
    );

    const totalUnread = channels.reduce((sum, channel) => {
      return sum + channel.countUnread();
    }, 0);

    const unreadGroupChats = channels.reduce((sum, channel) => {
      const isGroup = (channel.data as any)?.type === "group";
      return isGroup ? sum + channel.countUnread() : sum;
    }, 0);

    const unreadPersonalChats = Math.max(0, totalUnread - unreadGroupChats);

    res.json({
      data: {
        user_id: String(userId),
        display_name: user?.display_name || null,
        avatar_url: user?.avatar || null,
        online_status: "online",
        unread_messages: totalUnread,
        unread_group_chats: unreadGroupChats,
        unread_personal_chats: unreadPersonalChats,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get unified social inbox (Marketplace + Networks + Groups)
 * GET /api/v1/networks/social/inbox
 */
export const social_inbox_get = async (
  req: Request<{}, {}, {}, GetSocialInboxInput["query"]>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { filter, limit, offset } = req.query;

    // Update user presence for Networks
    await User.findByIdAndUpdate(userId, {
      networks_last_accessed: new Date(),
    });

    await chatService.ensureConnected();
    const client = chatService.getClient();

    // 1. Fetch channels from GetStream
    // We filter based on membership and type
    const streamFilters: any = {
      members: { $in: [String(userId)] },
      platform: "networks",
    };

    // Apply filters based on query
    if (filter === "unread") {
      streamFilters.unread_count = { $gt: 0 };
    }

    // Sort by last message/updated
    const sort: any = [{ last_message_at: -1 }];

    const streamChannels = await client.queryChannels(streamFilters, sort, {
      limit,
      offset,
      watch: false,
      presence: false,
    });

    // 2. Map channels to a unified response format
    const channels = streamChannels.map((c) => {
      const data = c.data as any;
      const isGroup = data?.type === "group";
      const name = data?.name || data?.listing_title || "Chat";
      const lastMsg = c.state.messages[c.state.messages.length - 1];

      return {
        id: c.id,
        type: isGroup ? "group" : "personal",
        name,
        avatar: data?.image || data?.listing_thumbnail,
        lastMessage: lastMsg?.text || "",
        lastMessageType: (lastMsg as any)?.custom?.type || "regular",
        timestamp: data?.last_message_at || data?.updated_at,
        unreadCount: c.countUnread() > 999 ? "999+" : c.countUnread(),
        badge: data?.last_event_type || (lastMsg as any)?.custom?.type || null,
        metadata: {
          listing_id: data?.listing_id,
          group_id: data?.group_id,
          is_reference_check:
            name.includes("Reference Check:") || !!data?.reference_check_id,
        },
      };
    });

    // 3. (Optional) Filter by message type / channel type
    let filteredChannels = channels;
    if (filter === "offers") {
      filteredChannels = channels.filter((c) =>
        c.lastMessageType.includes("offer"),
      );
    } else if (filter === "inquiries") {
      filteredChannels = channels.filter(
        (c) => c.lastMessageType === "inquiry",
      );
    } else if (filter === "reference_checks") {
      filteredChannels = channels.filter((c) => c.metadata.is_reference_check);
    }

    res.json({
      data: filteredChannels,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        paging: {
          count: filteredChannels.length,
          total: streamChannels.length, // approximation
          page: Math.floor(offset / limit) + 1,
          limit,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Multi-entity search (People, Groups, Messages)
 * GET /api/v1/networks/social/search
 */
export const social_search_get = async (
  req: Request<{}, {}, {}, SearchSocialInput["query"]>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const { q, type } = req.query;
    const results: any = {};

    // 1. Search People
    if (type === "all" || type === "people") {
      results.people = await User.find({
        $or: [
          { display_name: { $regex: q, $options: "i" } },
          { first_name: { $regex: q, $options: "i" } },
          { last_name: { $regex: q, $options: "i" } },
        ],
        networks_published: true,
      })
        .limit(10)
        .select("display_name avatar location first_name last_name")
        .lean();
    }

    // 2. Search Groups
    if (type === "all" || type === "groups") {
      results.groups = await SocialGroup.find({
        name: { $regex: q, $options: "i" },
        privacy: "public",
      })
        .limit(10)
        .lean();
    }

    // 3. Search Messages (Backfill from internal DB if synced, or GetStream)
    if (type === "all" || type === "messages") {
      if (!(req as any).user) throw new MissingUserContextError();
      const userId = (req as any).user.dialist_id;

      // Search internal ChatMessage model
      results.messages = await ChatMessage.find({
        text: { $regex: q, $options: "i" },
        platform: "networks",
        $or: [
          { sender_id: userId },
          // This is a simplified check, real check would need channel membership
          { stream_channel_id: { $in: await getStreamChannelIds(userId) } },
        ],
      })
        .limit(20)
        .sort({ createdAt: -1 })
        .lean();
    }

    res.json({
      data: results,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Discovery API (Recommended People & Groups)
 * GET /api/v1/networks/social/discover
 */
export const social_discover_get = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;

    // 1. Recommended Groups (Public groups only - canonical privacy filter)
    const groups = await SocialGroup.find({
      privacy: "public",
    })
      .sort({ member_count: -1 })
      .limit(5)
      .lean();

    // 2. Recommended People (Fall back to recently active for now)
    const people = await User.find({
      _id: { $ne: userId },
      networks_published: true,
      onboarding_status: "completed",
    })
      .sort({ networks_last_accessed: -1 })
      .limit(10)
      .select("display_name avatar location bio stats")
      .lean();

    res.json({
      data: {
        groups,
        people,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

// Helper for finding channels a user belongs to
async function getStreamChannelIds(
  userId: string | mongoose.Types.ObjectId,
): Promise<string[]> {
  try {
    const uid = new mongoose.Types.ObjectId(String(userId));

    // 1. Get marketplace/networks channels where user is buyer or seller
    const networksChannels = await NetworkListingChannel.find({
      $or: [{ buyer_id: uid }, { seller_id: uid }],
    })
      .select("getstream_channel_id")
      .lean();

    // 2. Get social groups user belongs to
    const groupMemberships = await SocialGroupMember.find({ user_id: uid })
      .populate("group_id", "getstream_channel_id")
      .lean();

    const channelIds: string[] = [
      ...networksChannels.map((c) => (c as any).getstream_channel_id),
      ...groupMemberships
        .map((m: any) => m.group_id?.getstream_channel_id)
        .filter(Boolean),
    ];

    return channelIds;
  } catch (err) {
    return [];
  }
}

/**
 * Get shared content (Media, Files, Links) for a channel
 * GET /api/v1/networks/social/conversations/:id/content
 */
export const social_shared_content_get = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      type = "media",
      limit: limitQ = "50",
      offset: offsetQ = "0",
    } = req.query;

    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;

    // Verify membership
    const channelIds = await getStreamChannelIds(userId);
    if (!channelIds.includes(id)) {
      res.status(403).json({
        error: { message: "Not authorized to view this channel's content" },
      });
      return;
    }

    let query: any = { stream_channel_id: id, is_deleted: { $ne: true } };

    // Canonical API types are media/files/links, with aliases kept for compatibility.
    const normalizedType = String(type || "media").toLowerCase();
    if (normalizedType === "media" || normalizedType === "image") {
      query.type = "image";
    } else if (normalizedType === "files" || normalizedType === "file") {
      query.type = "file";
    } else if (
      normalizedType === "links" ||
      normalizedType === "link" ||
      normalizedType === "url_enrichment"
    ) {
      query.type = "link";
    }

    const offset = Number(offsetQ);
    const limit = Number(limitQ);

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .lean();

    const data = messages.map((m) => ({
      message_id: m._id,
      type: m.type,
      attachments: m.attachments,
      text: m.text,
      createdAt: m.createdAt,
    }));

    // Canonical shared-content response with standardized envelope
    const response: ApiResponse<any> = {
      data,
      _metadata: {
        type: normalizedType,
        total: messages.length,
        offset: offset,
        limit: limit,
      },
      requestId: (req.headers["x-request-id"] as string) || "",
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Get chat-specific profile for a user (Social context)
 * GET /api/v1/networks/social/chat-profile/:userId
 */
export const social_chat_profile_get = async (
  req: Request<{ userId: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!(req as any).user) throw new MissingUserContextError();
    const myId = (req as any).user.dialist_id;

    const targetUser = await User.findById(userId)
      .select(
        "display_name avatar location createdAt networks_last_accessed bio",
      )
      .lean();

    if (!targetUser) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    // 1. Find Common Groups
    const [myGroups, theirGroups] = await Promise.all([
      SocialGroupMember.find({ user_id: myId }).select("group_id").lean(),
      SocialGroupMember.find({ user_id: userId }).select("group_id").lean(),
    ]);

    const myGroupIds = myGroups.map((g) => g.group_id.toString());
    const commonGroupIds = theirGroups
      .map((g) => g.group_id.toString())
      .filter((id) => myGroupIds.includes(id));

    const commonGroups = await SocialGroup.find({
      _id: { $in: commonGroupIds },
    })
      .limit(5)
      .lean();

    // 2. Active Trade Context (Offers/Inquiries)
    const activeListingChannels = await NetworkListingChannel.find({
      $or: [
        { buyer_id: myId, seller_id: userId },
        { buyer_id: userId, seller_id: myId },
      ],
      status: "open",
    })
      .populate("listing_id", "brand model thumbnail price")
      .limit(5)
      .lean();

    res.json({
      data: {
        profile: {
          ...targetUser,
          member_since: targetUser.createdAt,
        },
        commonGroups,
        activeTrade: activeListingChannels,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Search within a specific conversation
 * GET /api/v1/networks/social/conversations/:id/search
 */
export const social_chat_search_get = async (
  req: Request<{ id: string }, {}, {}, { q: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: channelId } = req.params;
    const { q } = req.query;

    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;

    if (!q) throw new ValidationError("Search query 'q' is required");

    // 1. Verify membership
    const channelIds = await getStreamChannelIds(userId);
    if (!channelIds.includes(channelId)) {
      res.status(403).json({
        error: { message: "Not authorized to search in this channel" },
      });
      return;
    }

    // 2. Search using MongoDB text index
    const messages = await ChatMessage.find({
      stream_channel_id: channelId,
      $text: { $search: q },
      is_deleted: { $ne: true },
    })
      .sort({ score: { $meta: "textScore" } })
      .limit(50)
      .lean();

    res.json({
      data: messages.map((m) => ({
        _id: m._id,
        text: m.text,
        sender_id: m.sender_id,
        createdAt: m.createdAt,
      })),
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get unified timeline of events for a conversation
 * GET /api/v1/networks/social/conversations/:id/events
 */
export const social_conversation_events_get = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: streamChannelId } = req.params;
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;

    // 1. Find Network Channel
    const channel = await NetworkListingChannel.findOne({
      getstream_channel_id: streamChannelId,
    });
    if (!channel) throw new NotFoundError("Conversation not found");

    // Check membership
    if (
      channel.buyer_id.toString() !== userId.toString() &&
      channel.seller_id.toString() !== userId.toString()
    ) {
      res.status(403).json({
        error: { message: "Not authorized to view events for this channel" },
      });
      return;
    }

    const events: any[] = [];

    // 2. Add Inquiries
    if (channel.inquiries) {
      channel.inquiries.forEach((inq) => {
        events.push({
          type: "inquiry",
          sender_id: inq.sender_id,
          message: inq.message,
          timestamp: inq.createdAt,
        });
      });
    }

    // 3. Add Offer History
    if (channel.offer_history) {
      channel.offer_history.forEach((offer) => {
        events.push({
          type: "offer",
          sender_id: offer.sender_id,
          amount: offer.amount,
          status: offer.status,
          offer_type: offer.offer_type,
          timestamp: offer.createdAt,
        });
      });
    }
    if (channel.last_offer) {
      events.push({
        type: "offer",
        sender_id: channel.last_offer.sender_id,
        amount: channel.last_offer.amount,
        status: channel.last_offer.status,
        offer_type: channel.last_offer.offer_type,
        timestamp: channel.last_offer.createdAt,
      });
    }

    // 4. Add Reference Check events
    const refCheck = await ReferenceCheck.findOne({
      getstream_channel_id: streamChannelId,
    });
    if (refCheck) {
      events.push({
        type: "reference_check_started",
        requester_id: refCheck.requester_id,
        target_id: refCheck.target_id,
        status: refCheck.status,
        timestamp: refCheck.createdAt,
      });

      if (refCheck.status === "completed") {
        events.push({
          type: "reference_check_completed",
          timestamp: refCheck.completed_at,
        });
      }

      // Add Vouches
      const vouches = await Vouch.find({ reference_check_id: refCheck._id });
      vouches.forEach((vouch) => {
        events.push({
          type: "vouch",
          voucher_name: vouch.voucher_snapshot.display_name,
          weight: vouch.weight,
          timestamp: vouch.createdAt,
        });
      });
    }

    // 5. Add Order events
    if (channel.order_id) {
      const order = await Order.findById(channel.order_id);
      if (order) {
        events.push({
          type: "order_created",
          order_id: order._id,
          status: order.status,
          timestamp: order.createdAt,
        });

        // Add status change events if available (mocked here based on status)
        if (order.status === "reserved") {
          events.push({
            type: "listing_reserved",
            timestamp: order.reserved_at,
          });
        }
      }
    }

    // Sort by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    res.json({
      data: events,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get groups shared between the current user and another user
 * GET /api/v1/networks/users/:id/common-groups
 */
export const social_common_groups_get = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    let myId: string | undefined;
    if ((req as any).user) {
      myId = (req as any).user.dialist_id;
    } else if ((req as any).auth?.userId) {
      // Fallback for test harnesses that set req.auth but not req.user
      const authId = (req as any).auth.userId;
      let u = null;
      if (mongoose.isValidObjectId(authId)) {
        u = await User.findById(authId).lean();
      }
      if (!u) {
        u = await User.findOne({ external_id: authId }).lean();
      }
      if (!u) {
        u = await User.findOne({ clerk_id: authId }).lean();
      }
      if (!u) {
        u = await User.findOne({ email: authId }).lean();
      }
      if (!u) throw new MissingUserContextError();
      myId = u._id.toString();
    } else {
      throw new MissingUserContextError();
    }
    const { id: userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      throw new ValidationError("Invalid user ID");
    }

    const targetUser = await User.findById(userId).lean();
    if (!targetUser) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    const [myGroups, theirGroups] = await Promise.all([
      SocialGroupMember.find({ user_id: myId }).select("group_id").lean(),
      SocialGroupMember.find({ user_id: userId }).select("group_id").lean(),
    ]);

    const myGroupIds = new Set(myGroups.map((g) => g.group_id.toString()));
    const commonGroupIds = theirGroups
      .map((g) => g.group_id.toString())
      .filter((id) => myGroupIds.has(id));

    const groups = await SocialGroup.find({ _id: { $in: commonGroupIds } })
      .limit(20)
      .lean();

    // Return property name expected by older integration tests
    const payload: any = {
      common_groups: groups,
      requestId: req.headers["x-request-id"] as string,
    };
    res.json(payload);
  } catch (err) {
    next(err);
  }
};
