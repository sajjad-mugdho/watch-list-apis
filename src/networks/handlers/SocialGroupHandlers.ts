// src/networks/handlers/SocialGroupHandlers.ts
import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import {
  MissingUserContextError,
  NotFoundError,
  ValidationError,
  } from "../../utils/errors";
import { SocialGroup } from "../../models/SocialGroup";
import { SocialGroupMember } from "../../models/SocialGroupMember";
import { chatService } from "../../services/ChatService";
import {
  CreateGroupInput,
  JoinGroupInput,
} from "../../validation/schemas";
import mongoose from "mongoose";
import logger from "../../utils/logger";

/**
 * Create a new social group
 * POST /api/v1/networks/social/groups
 */
export const social_group_create = async (
  req: Request<{}, {}, CreateGroupInput["body"]>,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const creatorId = (req as any).user.dialist_id;
    const { name, description, avatar, is_private, members = [] } = req.body;

    // 1. Create group in DB
    const [group] = await SocialGroup.create(
      [
        {
          name,
          description,
          avatar,
          is_private,
          created_by: creatorId,
          member_count: members.length + 1,
        },
      ],
      { session }
    );

    // 2. Add creator and initial members
    const groupMembers = [
      {
        group_id: group._id,
        user_id: creatorId,
        role: "admin",
      },
      ...members.map((mId) => ({
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
      logger.error("Failed to create GetStream channel for group", { chatError, groupId: group._id });
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
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { group_id } = req.params;

    const group = await SocialGroup.findById(group_id);
    if (!group) throw new NotFoundError("Social group not found");

    if (group.is_private) {
      throw new ValidationError("Cannot join a private group without an invite");
    }

    // Add member in DB
    await SocialGroupMember.findOneAndUpdate(
      { group_id, user_id: userId },
      { group_id, user_id: userId, role: "member" },
      { upsert: true }
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
      logger.error("Failed to add member to GetStream channel", { chatError, group_id, userId });
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
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { group_id } = req.params;

    const group = await SocialGroup.findById(group_id);
    if (!group) throw new NotFoundError("Social group not found");

    const membership = await SocialGroupMember.findOne({ group_id, user_id: userId });
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
          throw new ValidationError("You are the last admin. Please transfer ownership or promote another member before leaving.");
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
      logger.error("Failed to remove member from GetStream channel", { chatError, group_id, userId });
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
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const adminId = (req as any).user.dialist_id;
    const { id } = req.params;
    const { user_id } = req.body;

    // Verify requester is admin/mod
    const requester = await SocialGroupMember.findOne({ group_id: id, user_id: adminId });
    if (!requester || (requester.role !== "admin" && requester.role !== "moderator")) {
      res.status(403).json({ error: { message: "Only admins or moderators can add members" }, requestId: req.headers["x-request-id"] as string });
      return;
    }

    const group = await SocialGroup.findById(id);
    if (!group) throw new NotFoundError("Group not found");

    await SocialGroupMember.findOneAndUpdate(
      { group_id: id, user_id },
      { group_id: id, user_id, role: "member" },
      { upsert: true }
    );

    group.member_count = await SocialGroupMember.countDocuments({ group_id: id });
    await group.save();

    // Stream sync
    if (group.getstream_channel_id) {
      await chatService.ensureConnected();
      const client = chatService.getClient();
      const channel = client.channel("messaging", group.getstream_channel_id);
      await channel.addMembers([String(user_id)]);
    }

    res.json({ data: { success: true }, requestId: req.headers["x-request-id"] as string });
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
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const adminId = (req as any).user.dialist_id;
    const { id, userId } = req.params;

    if (String(adminId) === String(userId)) {
      res.status(400).json({ error: { message: "Use leave endpoint to remove yourself" }, requestId: req.headers["x-request-id"] as string });
      return;
    }

    // Verify requester is admin/mod
    const requester = await SocialGroupMember.findOne({ group_id: id, user_id: adminId });
    if (!requester || (requester.role !== "admin" && requester.role !== "moderator")) {
      res.status(403).json({ error: { message: "Only admins or moderators can remove members" }, requestId: req.headers["x-request-id"] as string });
      return;
    }

    const group = await SocialGroup.findById(id);
    if (!group) throw new NotFoundError("Group not found");

    await SocialGroupMember.findOneAndDelete({ group_id: id, user_id: userId });

    group.member_count = await SocialGroupMember.countDocuments({ group_id: id });
    await group.save();

    // Stream sync
    if (group.getstream_channel_id) {
      await chatService.ensureConnected();
      const client = chatService.getClient();
      const channel = client.channel("messaging", group.getstream_channel_id);
      await channel.removeMembers([String(userId)]);
    }

    res.json({ data: { success: true }, requestId: req.headers["x-request-id"] as string });
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
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id } = req.params;

    const membership = await SocialGroupMember.findOne({ group_id: id, user_id: userId });
    if (!membership) {
      res.status(404).json({ error: { message: "Not a member of this group" }, requestId: req.headers["x-request-id"] as string });
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

    res.json({ data: { muted: membership.muted }, requestId: req.headers["x-request-id"] as string });
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
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const adminId = (req as any).user.dialist_id;
    const { id, userId } = req.params;
    const { role } = req.body;

    if (!["admin", "moderator", "member"].includes(role)) {
      throw new ValidationError("Invalid role");
    }

    const requester = await SocialGroupMember.findOne({ group_id: id, user_id: adminId });
    if (!requester || requester.role !== "admin") {
      res.status(403).json({ error: { message: "Only admins can change roles" }, requestId: req.headers["x-request-id"] as string });
      return;
    }

    const membership = await SocialGroupMember.findOne({ group_id: id, user_id: userId });
    if (!membership) throw new NotFoundError("Member not found");

    membership.role = role;
    await membership.save();

    res.json({ data: { success: true, role: membership.role }, requestId: req.headers["x-request-id"] as string });
  } catch (err) {
    next(err);
  }
};
