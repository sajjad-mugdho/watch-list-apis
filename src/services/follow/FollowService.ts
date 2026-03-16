/**
 * Follow Service
 *
 * Instagram-style follow system:
 * - Public accounts: follow is auto-accepted
 * - Private accounts: follow requires acceptance
 */

import { Types } from "mongoose";
import { Follow, IFollow } from "../../models/Follow";
import { User } from "../../models/User";
import { Notification } from "../../models/Notification";
import { feedService } from "../FeedService";
import logger from "../../utils/logger";

export class FollowService {
  /**
   * Follow a user.
   * If target is public → status = "accepted" immediately.
   * If target is private → status = "pending", notify target.
   */
  async follow(followerId: string, targetId: string): Promise<IFollow> {
    if (followerId === targetId) {
      throw new Error("Cannot follow yourself");
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    const existing = await Follow.findOne({
      follower_id: followerId,
      following_id: targetId,
    });

    if (existing) {
      if (existing.status === "accepted") {
        throw new Error("Already following this user");
      }
      if (existing.status === "pending") {
        throw new Error("Follow request already pending");
      }
    }

    const isPrivate = targetUser.is_private === true;
    const status = isPrivate ? "pending" : "accepted";

    const follow = await Follow.create({
      follower_id: new Types.ObjectId(followerId),
      following_id: new Types.ObjectId(targetId),
      status,
      accepted_at: isPrivate ? null : new Date(),
    });

    if (status === "accepted") {
      await this.syncFollowCounts(followerId, targetId);
      try {
        await feedService.follow(followerId, targetId);
      } catch (err) {
        logger.warn("[FollowService] Failed to sync follow to Stream Feeds", {
          err,
        });
      }
    }

    // Notify target
    try {
      const follower = await User.findById(followerId).select("display_name");
      await Notification.create({
        user_id: targetId,
        type: isPrivate ? "follow_request" : "new_follower",
        title: isPrivate ? "New Follow Request" : "New Follower",
        body: isPrivate
          ? `${follower?.display_name || "Someone"} wants to follow you.`
          : `${follower?.display_name || "Someone"} started following you.`,
        data: { follower_id: followerId },
        action_url: `/users/${followerId}`,
      });
    } catch (err) {
      logger.warn("[FollowService] Failed to create follow notification", {
        err,
      });
    }

    logger.info("[FollowService] Follow created", {
      followerId,
      targetId,
      status,
    });
    return follow;
  }

  /**
   * Accept a pending follow request (only target can accept).
   */
  async acceptFollowRequest(
    targetId: string,
    followId: string,
  ): Promise<IFollow> {
    const follow = await Follow.findById(followId);
    if (!follow) {
      throw new Error("Follow request not found");
    }

    if (follow.following_id.toString() !== targetId) {
      throw new Error("Only the target user can accept this request");
    }

    if (follow.status !== "pending") {
      throw new Error(`Cannot accept: request is ${follow.status}`);
    }

    follow.status = "accepted";
    follow.accepted_at = new Date();
    await follow.save();

    await this.syncFollowCounts(
      follow.follower_id.toString(),
      follow.following_id.toString(),
    );

    try {
      await feedService.follow(
        follow.follower_id.toString(),
        follow.following_id.toString(),
      );
    } catch (err) {
      logger.warn("[FollowService] Failed to sync accepted follow to Stream", {
        err,
      });
    }

    // Notify requester
    try {
      const target = await User.findById(targetId).select("display_name");
      await Notification.create({
        user_id: follow.follower_id,
        type: "follow_request_accepted",
        title: "Follow Request Accepted",
        body: `${target?.display_name || "Someone"} accepted your follow request.`,
        data: { target_id: targetId },
        action_url: `/users/${targetId}`,
      });
    } catch (err) {
      logger.warn("[FollowService] Failed to send acceptance notification", {
        err,
      });
    }

    logger.info("[FollowService] Follow request accepted", { followId });
    return follow;
  }

  /**
   * Reject a pending follow request (only target can reject).
   */
  async rejectFollowRequest(targetId: string, followId: string): Promise<void> {
    const follow = await Follow.findById(followId);
    if (!follow) {
      throw new Error("Follow request not found");
    }

    if (follow.following_id.toString() !== targetId) {
      throw new Error("Only the target user can reject this request");
    }

    if (follow.status !== "pending") {
      throw new Error(`Cannot reject: request is ${follow.status}`);
    }

    await follow.deleteOne();
    logger.info("[FollowService] Follow request rejected", { followId });
  }

  /**
   * Unfollow a user (or cancel pending request).
   */
  async unfollow(followerId: string, targetId: string): Promise<void> {
    const follow = await Follow.findOneAndDelete({
      follower_id: followerId,
      following_id: targetId,
    });

    if (!follow) {
      throw new Error("Not following this user");
    }

    if (follow.status === "accepted") {
      await this.syncFollowCounts(followerId, targetId);
      try {
        await feedService.unfollow(followerId, targetId);
      } catch (err) {
        logger.warn("[FollowService] Failed to sync unfollow to Stream Feeds", {
          err,
        });
      }
    }

    logger.info("[FollowService] Unfollowed", { followerId, targetId });
  }

  /**
   * Get accepted followers of a user.
   */
  async getFollowers(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ followers: any[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const query = { following_id: userId, status: "accepted" as const };
    const [follows, total] = await Promise.all([
      Follow.find(query)
        .sort({ accepted_at: -1 })
        .skip(offset)
        .limit(limit)
        .populate("follower_id", "_id display_name avatar"),
      Follow.countDocuments(query),
    ]);

    const followers = follows.map((f) => ({
      user: f.follower_id,
      followed_at: f.accepted_at || f.createdAt,
    }));

    return { followers, total };
  }

  /**
   * Get users that a user is following (accepted only).
   */
  async getFollowing(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ following: any[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const query = { follower_id: userId, status: "accepted" as const };
    const [follows, total] = await Promise.all([
      Follow.find(query)
        .sort({ accepted_at: -1 })
        .skip(offset)
        .limit(limit)
        .populate("following_id", "_id display_name avatar"),
      Follow.countDocuments(query),
    ]);

    const following = follows.map((f) => ({
      user: f.following_id,
      followed_at: f.accepted_at || f.createdAt,
    }));

    return { following, total };
  }

  /**
   * Get pending incoming follow requests for a user.
   */
  async getPendingRequests(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ requests: any[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const query = { following_id: userId, status: "pending" as const };
    const [follows, total] = await Promise.all([
      Follow.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("follower_id", "_id display_name avatar"),
      Follow.countDocuments(query),
    ]);

    const requests = follows.map((f) => ({
      follow_id: (f._id as Types.ObjectId).toString(),
      user: f.follower_id,
      requested_at: f.createdAt,
    }));

    return { requests, total };
  }

  /**
   * Get follow status between two users.
   */
  async getFollowStatus(
    currentUserId: string,
    targetId: string,
  ): Promise<{
    is_following: boolean;
    is_followed_by: boolean;
    follow_status: string | null;
    followed_by_status: string | null;
  }> {
    const [outgoing, incoming] = await Promise.all([
      Follow.findOne({ follower_id: currentUserId, following_id: targetId }),
      Follow.findOne({ follower_id: targetId, following_id: currentUserId }),
    ]);

    return {
      is_following: outgoing?.status === "accepted",
      is_followed_by: incoming?.status === "accepted",
      follow_status: outgoing?.status ?? null,
      followed_by_status: incoming?.status ?? null,
    };
  }

  // ----------------------------------------------------------
  // Private Helpers
  // ----------------------------------------------------------

  private async syncFollowCounts(
    userId1: string,
    userId2: string,
  ): Promise<void> {
    try {
      const [followingCount1, followerCount1, followingCount2, followerCount2] =
        await Promise.all([
          Follow.getFollowingCount(userId1),
          Follow.getFollowersCount(userId1),
          Follow.getFollowingCount(userId2),
          Follow.getFollowersCount(userId2),
        ]);

      await Promise.all([
        User.findByIdAndUpdate(userId1, {
          $set: {
            "stats.following_count": followingCount1,
            "stats.follower_count": followerCount1,
          },
        }),
        User.findByIdAndUpdate(userId2, {
          $set: {
            "stats.following_count": followingCount2,
            "stats.follower_count": followerCount2,
          },
        }),
      ]);
    } catch (err) {
      logger.warn("[FollowService] Failed to sync follow counts", { err });
    }
  }
}

export const followService = new FollowService();
