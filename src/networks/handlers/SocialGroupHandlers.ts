// src/networks/handlers/SocialGroupHandlers.ts
import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import {
  MissingUserContextError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors";
import { SocialGroup } from "../models/SocialGroup";
import { SocialGroupMember } from "../models/SocialGroupMember";
import { chatService } from "../../services/ChatService";
import { CreateGroupInput, JoinGroupInput } from "../../validation/schemas";
import mongoose from "mongoose";
import logger from "../../utils/logger";

/**
 * Create a new social group
 * POST /api/v1/networks/social/groups
 */
export const social_group_create = async (
  req: Request<{}, {}, CreateGroupInput["body"]>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const creatorId = (req as any).user.dialist_id;
    const {
      name,
      description,
      avatar,
      privacy,
      members = [],
    } = req.body as any;

    // Canonical privacy field usage (public | invite_only | secret)
    const canonicalPrivacy = privacy || "public";

    // 1. Create group in DB
    const [group] = await SocialGroup.create(
      [
        {
          name,
          description,
          avatar,
          privacy: canonicalPrivacy,
          created_by: creatorId,
          member_count: members.length + 1,
        },
      ],
      { session },
    );

    // 2. Add creator and initial members
    const groupMembers = [
      {
        group_id: group._id,
        user_id: creatorId,
        role: "admin",
      },
      ...members.map((mId: string | mongoose.Types.ObjectId) => ({
        group_id: group._id,
        user_id: mId,
        role: "member",
      })),
    ];

    await SocialGroupMember.insertMany(groupMembers, { session });

    // 3. Create GetStream channel for the group
    try {
      await chatService.ensureConnected();
      const client = chatService.getClient();
      const channelId = `group_${group._id}`;

      const channel = client.channel("messaging", channelId, {
        name,
        image: avatar,
        created_by_id: String(creatorId),
        members: [String(creatorId), ...members.map(String)],
        type: "group",
        platform: "networks",
        group_id: String(group._id),
      } as any);

      await channel.create();

      // Update group with stream ID
      group.getstream_channel_id = channelId;
      await group.save({ session });
    } catch (chatError) {
      logger.error("Failed to create GetStream channel for group", {
        chatError,
        groupId: group._id,
      });
      // We continue since DB is source of truth, but this might need manual sync
    }

    await session.commitTransaction();

    res.status(201).json({
      data: group,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * Join a social group
 * POST /api/v1/networks/social/groups/:group_id/join
 */
export const social_group_join = async (
  req: Request<JoinGroupInput["params"]>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { group_id } = req.params;

    const group = await SocialGroup.findById(group_id);
    if (!group) throw new NotFoundError("Social group not found");

    if (group.privacy !== "public") {
      throw new ValidationError(
        "Cannot join a private group without an invite",
      );
    }

    // Add member in DB
    await SocialGroupMember.findOneAndUpdate(
      { group_id, user_id: userId },
      { group_id, user_id: userId, role: "member" },
      { upsert: true },
    );

    // Update member count
    group.member_count = await SocialGroupMember.countDocuments({ group_id });
    await group.save();

    // Add to GetStream channel
    try {
      if (group.getstream_channel_id) {
        await chatService.ensureConnected();
        const client = chatService.getClient();
        const channel = client.channel("messaging", group.getstream_channel_id);
        await channel.addMembers([String(userId)]);
      }
    } catch (chatError) {
      logger.error("Failed to add member to GetStream channel", {
        chatError,
        group_id,
        userId,
      });
    }

    res.json({
      data: { success: true },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Leave a social group
 * DELETE /api/v1/networks/social/groups/:group_id/leave
 */
export const social_group_leave = async (
  req: Request<JoinGroupInput["params"]>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { group_id } = req.params;

    const group = await SocialGroup.findById(group_id);
    if (!group) throw new NotFoundError("Social group not found");

    const membership = await SocialGroupMember.findOne({
      group_id,
      user_id: userId,
    });
    if (!membership) throw new NotFoundError("Not a member of this group");

    if (membership.role === "admin") {
      const otherAdmins = await SocialGroupMember.countDocuments({
        group_id,
        role: "admin",
        user_id: { $ne: userId },
      });

      if (otherAdmins === 0) {
        const otherMembers = await SocialGroupMember.countDocuments({
          group_id,
          user_id: { $ne: userId },
        });

        if (otherMembers > 0) {
          throw new ValidationError(
            "You are the last admin. Please transfer ownership or promote another member before leaving.",
          );
        }
      }
    }

    await SocialGroupMember.findOneAndDelete({ group_id, user_id: userId });

    // Update member count
    group.member_count = await SocialGroupMember.countDocuments({ group_id });
    await group.save();

    // Remove from GetStream channel
    try {
      if (group.getstream_channel_id) {
        await chatService.ensureConnected();
        const client = chatService.getClient();
        const channel = client.channel("messaging", group.getstream_channel_id);
        await channel.removeMembers([String(userId)]);
      }
    } catch (chatError) {
      logger.error("Failed to remove member from GetStream channel", {
        chatError,
        group_id,
        userId,
      });
    }

    res.json({
      data: { success: true },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add member to group
 * POST /api/v1/networks/social/groups/:id/members
 */
export const social_group_members_add = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const adminId = (req as any).user.dialist_id;
    const { id } = req.params;
    const { user_id } = req.body;

    // Verify requester is admin/mod
    const requester = await SocialGroupMember.findOne({
      group_id: id,
      user_id: adminId,
    });
    if (
      !requester ||
      (requester.role !== "admin" && requester.role !== "moderator")
    ) {
      res.status(403).json({
        error: { message: "Only admins or moderators can add members" },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    const group = await SocialGroup.findById(id);
    if (!group) throw new NotFoundError("Group not found");

    await SocialGroupMember.findOneAndUpdate(
      { group_id: id, user_id },
      { group_id: id, user_id, role: "member" },
      { upsert: true },
    );

    group.member_count = await SocialGroupMember.countDocuments({
      group_id: id,
    });
    await group.save();

    // Stream sync
    if (group.getstream_channel_id) {
      await chatService.ensureConnected();
      const client = chatService.getClient();
      const channel = client.channel("messaging", group.getstream_channel_id);
      await channel.addMembers([String(user_id)]);
    }

    res.json({
      data: { success: true },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Remove member from group
 * DELETE /api/v1/networks/social/groups/:id/members/:userId
 */
export const social_group_members_remove = async (
  req: Request<{ id: string; userId: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const adminId = (req as any).user.dialist_id;
    const { id, userId } = req.params;

    if (String(adminId) === String(userId)) {
      res.status(400).json({
        error: { message: "Use leave endpoint to remove yourself" },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    // Verify requester is admin/mod
    const requester = await SocialGroupMember.findOne({
      group_id: id,
      user_id: adminId,
    });
    if (
      !requester ||
      (requester.role !== "admin" && requester.role !== "moderator")
    ) {
      res.status(403).json({
        error: { message: "Only admins or moderators can remove members" },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    const group = await SocialGroup.findById(id);
    if (!group) throw new NotFoundError("Group not found");

    await SocialGroupMember.findOneAndDelete({ group_id: id, user_id: userId });

    group.member_count = await SocialGroupMember.countDocuments({
      group_id: id,
    });
    await group.save();

    // Stream sync
    if (group.getstream_channel_id) {
      await chatService.ensureConnected();
      const client = chatService.getClient();
      const channel = client.channel("messaging", group.getstream_channel_id);
      await channel.removeMembers([String(userId)]);
    }

    res.json({
      data: { success: true },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Toggle mute notifications for a group
 * POST /api/v1/networks/social/groups/:id/mute
 */
export const social_group_mute = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id } = req.params;

    const membership = await SocialGroupMember.findOne({
      group_id: id,
      user_id: userId,
    });
    if (!membership) {
      res.status(404).json({
        error: { message: "Not a member of this group" },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    membership.muted = !membership.muted;
    await membership.save();

    // Stream sync (optional, can also use stream mute but we track it in DB for custom logic)
    const group = await SocialGroup.findById(id);
    if (group?.getstream_channel_id) {
      await chatService.ensureConnected();
      const client = chatService.getClient();
      const channel = client.channel("messaging", group.getstream_channel_id);
      if (membership.muted) {
        await channel.mute({ user_id: String(userId) });
      } else {
        await channel.unmute({ user_id: String(userId) });
      }
    }

    res.json({
      data: { muted: membership.muted },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Promote or demote a member (Admin only)
 * PATCH /api/v1/networks/social/groups/:id/members/:userId/role
 */
export const social_group_member_role_update = async (
  req: Request<{ id: string; userId: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const adminId = (req as any).user.dialist_id;
    const { id, userId } = req.params;
    const { role } = req.body;

    if (!["admin", "moderator", "member"].includes(role)) {
      throw new ValidationError("Invalid role");
    }

    const requester = await SocialGroupMember.findOne({
      group_id: id,
      user_id: adminId,
    });
    if (!requester || requester.role !== "admin") {
      res.status(403).json({
        error: { message: "Only admins can change roles" },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    const membership = await SocialGroupMember.findOne({
      group_id: id,
      user_id: userId,
    });
    if (!membership) throw new NotFoundError("Member not found");

    membership.role = role;
    await membership.save();

    res.json({
      data: { success: true, role: membership.role },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List all members of a group
 * GET /api/v1/networks/social/groups/:id/members
 */
export const social_group_members_list = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id } = req.params;

    // Verify user is member of group
    const group = await SocialGroup.findById(id);
    if (!group) throw new NotFoundError("Group not found");

    if (group.privacy !== "public") {
      const membership = await SocialGroupMember.findOne({
        group_id: id,
        user_id: userId,
      });
      if (!membership) {
        res.status(403).json({
          error: { message: "Not a member of this group" },
          requestId: req.headers["x-request-id"] as string,
        });
        return;
      }
    }

    // Get all members
    const members = await SocialGroupMember.find({ group_id: id }).lean();

    const membersList = members.map((m: any) => ({
      user_id: String(m.user_id),
      role: m.role,
      joined_at: (m as any).createdAt,
      muted: m.muted || false,
    }));

    res.json({
      data: membersList,
      _metadata: {
        total: membersList.length,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get shared links from a group
 * GET /api/v1/networks/social/groups/:id/shared-links
 */
export const social_group_shared_links_get = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id } = req.params;
    const { limit: limitQ = "50", offset: offsetQ = "0" } = req.query;

    // Verify membership
    const group = await SocialGroup.findById(id);
    if (!group) throw new NotFoundError("Group not found");

    const membership = await SocialGroupMember.findOne({
      group_id: id,
      user_id: userId,
    });

    if (!membership && group.privacy !== "public") {
      res.status(403).json({
        error: { message: "Not authorized to view group content" },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    // Get shared links from this group's GetStream channel
    const query: any = {
      stream_channel_id: group.getstream_channel_id,
      type: "link",
      is_deleted: { $ne: true },
    };

    const offset = Number(offsetQ);
    const limit = Number(limitQ);

    const { ChatMessage } = require("../../models/ChatMessage");
    const links = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const data = links.map((msg: any) => ({
      link_id: msg._id,
      url: msg.text || msg.attachments?.[0]?.url,
      title: msg.attachments?.[0]?.title || "",
      description: msg.attachments?.[0]?.description || "",
      shared_by: msg.senderId,
      shared_at: msg.createdAt,
    }));

    res.json({
      data,
      _metadata: {
        type: "links",
        total: data.length,
        offset,
        limit,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add a shared link to a group
 * POST /api/v1/networks/social/groups/:id/shared-links
 */
export const social_group_shared_links_post = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id } = req.params;
    const { url, title, description } = req.body;

    if (!url) {
      throw new ValidationError("URL is required");
    }

    // Verify membership
    const group = await SocialGroup.findById(id);
    if (!group) throw new NotFoundError("Group not found");

    const membership = await SocialGroupMember.findOne({
      group_id: id,
      user_id: userId,
    });

    if (!membership) {
      res.status(403).json({
        error: { message: "Not a member of this group" },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    // Create a message with link attachment in GetStream
    try {
      await chatService.ensureConnected();
      const client = chatService.getClient();
      const channel = client.channel("messaging", group.getstream_channel_id);

      const message = await channel.sendMessage({
        // Cast types to any to avoid strict third-party typings conflicts in tests
        text: url,
        user_id: String(userId),
        type: "link" as any,
        attachments: [
          {
            type: "link" as any,
            url: url as any,
            title: title || "",
            description: description || "",
          } as any,
        ] as any,
      } as any);

      res.status(201).json({
        data: {
          link_id: message.message.id,
          url,
          title: title || "",
          description: description || "",
          shared_at: new Date().toISOString(),
        },
        requestId: req.headers["x-request-id"] as string,
      });
    } catch (err) {
      logger.error("Failed to add shared link", { err, groupId: id });
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Get shared media (images) from a group
 * GET /api/v1/networks/social/groups/:id/shared-media
 */
export const social_group_shared_media_get = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id } = req.params;
    const { limit: limitQ = "50", offset: offsetQ = "0" } = req.query;

    // Verify membership
    const group = await SocialGroup.findById(id);
    if (!group) throw new NotFoundError("Group not found");

    const membership = await SocialGroupMember.findOne({
      group_id: id,
      user_id: userId,
    });

    if (!membership && group.privacy !== "public") {
      res.status(403).json({
        error: { message: "Not authorized to view group content" },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    const query: any = {
      stream_channel_id: group.getstream_channel_id,
      type: "image",
      is_deleted: { $ne: true },
    };

    const offset = Number(offsetQ);
    const limit = Number(limitQ);

    const { ChatMessage } = require("../../models/ChatMessage");
    const mediaMessages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const data = mediaMessages.map((msg: any) => ({
      media_id: msg._id,
      url: msg.attachments?.[0]?.url || "",
      caption: msg.text || "",
      shared_by: msg.senderId,
      shared_at: msg.createdAt,
    }));

    res.json({
      data,
      _metadata: {
        type: "media",
        total: data.length,
        offset,
        limit,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get shared files from a group
 * GET /api/v1/networks/social/groups/:id/shared-files
 */
export const social_group_shared_files_get = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id } = req.params;
    const { limit: limitQ = "50", offset: offsetQ = "0" } = req.query;

    // Verify membership
    const group = await SocialGroup.findById(id);
    if (!group) throw new NotFoundError("Group not found");

    const membership = await SocialGroupMember.findOne({
      group_id: id,
      user_id: userId,
    });

    if (!membership && group.privacy !== "public") {
      res.status(403).json({
        error: { message: "Not authorized to view group content" },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    const query: any = {
      stream_channel_id: group.getstream_channel_id,
      type: "file",
      is_deleted: { $ne: true },
    };

    const offset = Number(offsetQ);
    const limit = Number(limitQ);

    const { ChatMessage } = require("../../models/ChatMessage");
    const fileMessages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const data = fileMessages.map((msg: any) => ({
      file_id: msg._id,
      filename: msg.attachments?.[0]?.title || "file",
      url: msg.attachments?.[0]?.url || "",
      size: msg.attachments?.[0]?.size || 0,
      shared_by: msg.senderId,
      shared_at: msg.createdAt,
    }));

    res.json({
      data,
      _metadata: {
        type: "files",
        total: data.length,
        offset,
        limit,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List social groups (public + groups the current user belongs to)
 * GET /api/v1/networks/social/groups
 */
export const social_group_get_all = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;

    const memberships = await SocialGroupMember.find({ user_id: userId })
      .select("group_id")
      .lean();
    const memberGroupIds = memberships.map((m) => m.group_id);

    const groups = await SocialGroup.find({
      $or: [{ privacy: "public" }, { _id: { $in: memberGroupIds } }],
    })
      .sort({ member_count: -1, createdAt: -1 })
      .lean();

    res.json({
      data: groups,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a single social group by ID
 * GET /api/v1/networks/social/groups/:id
 */
export const social_group_get = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid group ID");
    }

    const group = await SocialGroup.findById(id).lean();
    if (!group) throw new NotFoundError("Group");

    if ((group as any).privacy !== "public") {
      const membership = await SocialGroupMember.findOne({
        group_id: id,
        user_id: userId,
      });
      if (!membership) {
        res.status(403).json({
          error: { message: "This group is private" },
          requestId: req.headers["x-request-id"] as string,
        });
        return;
      }
    }

    const memberCount = await SocialGroupMember.countDocuments({
      group_id: id,
    });

    // Fetch group members with role information
    const members = await SocialGroupMember.find({ group_id: id }).lean();
    const membersList = members.map((m) => ({
      user_id: m.user_id.toString(),
      role: m.role, // owner, admin, member
      // createdAt isn't guaranteed on the flattened/lean type, fall back to ObjectId timestamp or now
      joined_at:
        (m as any).createdAt ||
        ((m as any)._id && (m as any)._id.getTimestamp
          ? (m as any)._id.getTimestamp()
          : new Date()),
      // follow_status will be populated when follow service is integrated
      // For now: placeholder for follow_status as 'not_following' | 'following' | 'pending_request'
      follow_status: "not_following",
      can_remove:
        userId ===
        ((group as any).created_by?.toString?.() ||
          (group as any).creator_id?.toString?.()),
    }));

    res.json({
      data: { ...group, member_count: memberCount, members: membersList },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};
