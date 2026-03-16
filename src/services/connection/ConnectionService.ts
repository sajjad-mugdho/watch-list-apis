/**
 * Connection Service
 *
 * Michael-aligned connection behavior:
 * - Every request starts as pending
 * - Target user accepts or rejects
 * - Reverse pending requests auto-resolve to mutual accepted state
 */

import { Types } from "mongoose";
import { Connection, IConnection } from "../../networks/models/Connection";
import { User } from "../../models/User";
import { feedService } from "../FeedService";
import logger from "../../utils/logger";
import { Block } from "../../networks/models/Block";

const FEED_SYNC_RETRY_MAX_ATTEMPTS = 3;
const FEED_SYNC_RETRY_BASE_DELAY_MS = 300;

export class ConnectionService {
  /**
   * Send a connection request. All requests are pending by default.
   */
  async requestConnection(
    requesterId: string,
    targetId: string,
  ): Promise<IConnection> {
    if (requesterId === targetId) {
      throw new Error("Cannot connect with yourself");
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    const blocked = await Block.findOne({
      $or: [
        { blocker_id: requesterId, blocked_id: targetId },
        { blocker_id: targetId, blocked_id: requesterId },
      ],
    });

    if (blocked) {
      throw new Error("Cannot connect due to block relationship");
    }

    const existing = await Connection.findOne({
      follower_id: requesterId,
      following_id: targetId,
    });

    if (existing) {
      if (existing.status === "accepted") {
        throw new Error("Already connected with this user");
      }
      if (existing.status === "pending") {
        throw new Error("Connection request already pending");
      }
    }

    const reversePending = await Connection.findOne({
      follower_id: targetId,
      following_id: requesterId,
      status: "pending",
    });

    if (reversePending) {
      const acceptedAt = new Date();

      reversePending.status = "accepted";
      reversePending.accepted_at = acceptedAt;
      await reversePending.save();

      const mutual = await Connection.create({
        follower_id: new Types.ObjectId(requesterId),
        following_id: new Types.ObjectId(targetId),
        status: "accepted",
        accepted_at: acceptedAt,
      });

      await this.syncConnectionCounts(requesterId, targetId);

      await this.syncFeedFollowWithRetry(
        requesterId,
        targetId,
        "accept-reverse",
      );
      await this.syncFeedFollowWithRetry(
        targetId,
        requesterId,
        "accept-reverse",
      );

      logger.info("[ConnectionService] Reverse pending auto-accepted", {
        requesterId,
        targetId,
      });

      return mutual;
    }

    const connection = await Connection.create({
      follower_id: new Types.ObjectId(requesterId),
      following_id: new Types.ObjectId(targetId),
      status: "pending",
      accepted_at: null,
    });

    await this.notifyTargetOfRequest(requesterId, targetId);

    logger.info("[ConnectionService] Connection request created", {
      requesterId,
      targetId,
      status: "pending",
    });

    return connection;
  }

  /**
   * Accept an incoming pending request. Only target can accept.
   */
  async acceptConnectionRequest(
    targetId: string,
    requestId: string,
  ): Promise<IConnection> {
    const connection = await Connection.findById(requestId);
    if (!connection) {
      throw new Error("Connection request not found");
    }

    if (connection.following_id.toString() !== targetId) {
      throw new Error("Only the target user can accept this request");
    }

    // Re-check block state before accepting (blocks could be added after request creation)
    const Block = require("../../networks/models/Block").Block;
    const blocked = await Block.findOne({
      $or: [
        {
          blocker_id: connection.follower_id,
          blocked_id: connection.following_id,
        },
        {
          blocker_id: connection.following_id,
          blocked_id: connection.follower_id,
        },
      ],
    });

    if (blocked) {
      throw new Error("Cannot accept due to block relationship");
    }

    if (connection.status !== "pending") {
      throw new Error(`Cannot accept: request is ${connection.status}`);
    }

    connection.status = "accepted";
    connection.accepted_at = new Date();
    await connection.save();

    const requesterId = connection.follower_id.toString();
    await this.syncConnectionCounts(requesterId, targetId);
    await this.syncFeedFollowWithRetry(requesterId, targetId, "accept");
    await this.notifyRequesterAccepted(requesterId, targetId);

    logger.info("[ConnectionService] Connection request accepted", {
      requestId,
      requesterId,
      targetId,
    });

    return connection;
  }

  /**
   * Reject an incoming pending request. Only target can reject.
   */
  async rejectConnectionRequest(
    targetId: string,
    requestId: string,
  ): Promise<void> {
    const connection = await Connection.findById(requestId);
    if (!connection) {
      throw new Error("Connection request not found");
    }

    if (connection.following_id.toString() !== targetId) {
      throw new Error("Only the target user can reject this request");
    }

    if (connection.status !== "pending") {
      throw new Error(`Cannot reject: request is ${connection.status}`);
    }

    await connection.deleteOne();

    logger.info("[ConnectionService] Connection request rejected", {
      requestId,
      targetId,
    });
  }

  /**
   * Remove outgoing accepted/pending request.
   */
  async removeConnection(requesterId: string, targetId: string): Promise<void> {
    const connection = await Connection.findOneAndDelete({
      follower_id: requesterId,
      following_id: targetId,
    });

    if (!connection) {
      throw new Error("No connection found for this user");
    }

    if (connection.status === "accepted") {
      await this.syncConnectionCounts(requesterId, targetId);
      await this.syncFeedUnfollowWithRetry(requesterId, targetId, "remove");
    }

    logger.info("[ConnectionService] Connection removed", {
      requesterId,
      targetId,
    });
  }

  async getIncomingConnections(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ connections: any[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const query = { following_id: userId, status: "accepted" as const };
    const [connections, total] = await Promise.all([
      Connection.find(query)
        .sort({ accepted_at: -1 })
        .skip(offset)
        .limit(limit)
        .populate("follower_id", "_id display_name avatar"),
      Connection.countDocuments(query),
    ]);

    return {
      connections: connections.map((c) => ({
        user: c.follower_id,
        connected_at: c.accepted_at || c.createdAt,
      })),
      total,
    };
  }

  async getOutgoingConnections(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ connections: any[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const query = { follower_id: userId, status: "accepted" as const };
    const [connections, total] = await Promise.all([
      Connection.find(query)
        .sort({ accepted_at: -1 })
        .skip(offset)
        .limit(limit)
        .populate("following_id", "_id display_name avatar"),
      Connection.countDocuments(query),
    ]);

    return {
      connections: connections.map((c) => ({
        user: c.following_id,
        connected_at: c.accepted_at || c.createdAt,
      })),
      total,
    };
  }

  async getPendingRequests(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ requests: any[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const query = { following_id: userId, status: "pending" as const };
    const [connections, total] = await Promise.all([
      Connection.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("follower_id", "_id display_name avatar"),
      Connection.countDocuments(query),
    ]);

    return {
      requests: connections.map((c) => ({
        connection_id: (c._id as Types.ObjectId).toString(),
        user: c.follower_id,
        requested_at: c.createdAt,
      })),
      total,
    };
  }

  async getConnectionStatus(
    currentUserId: string,
    targetId: string,
  ): Promise<{
    is_connected_to: boolean;
    is_connected_by: boolean;
    outgoing_status: string | null;
    incoming_status: string | null;
  }> {
    const [outgoing, incoming] = await Promise.all([
      Connection.findOne({
        follower_id: currentUserId,
        following_id: targetId,
      }),
      Connection.findOne({
        follower_id: targetId,
        following_id: currentUserId,
      }),
    ]);

    return {
      is_connected_to: outgoing?.status === "accepted",
      is_connected_by: incoming?.status === "accepted",
      outgoing_status: outgoing?.status ?? null,
      incoming_status: incoming?.status ?? null,
    };
  }

  private async syncConnectionCounts(
    userId1: string,
    userId2: string,
  ): Promise<void> {
    try {
      const [outgoing1, incoming1, outgoing2, incoming2] = await Promise.all([
        Connection.getOutgoingCount(userId1),
        Connection.getIncomingCount(userId1),
        Connection.getOutgoingCount(userId2),
        Connection.getIncomingCount(userId2),
      ]);

      await Promise.all([
        User.findByIdAndUpdate(userId1, {
          $set: {
            "stats.following_count": outgoing1,
            "stats.follower_count": incoming1,
          },
        }),
        User.findByIdAndUpdate(userId2, {
          $set: {
            "stats.following_count": outgoing2,
            "stats.follower_count": incoming2,
          },
        }),
      ]);
    } catch (err) {
      logger.warn("[ConnectionService] Failed to sync connection counts", {
        err,
      });
    }
  }

  private async notifyTargetOfRequest(
    requesterId: string,
    targetId: string,
  ): Promise<void> {
    try {
      const requester = await User.findById(requesterId).select("display_name");
      // TODO: Use platform-specific notification service
      /*      await Notification.create({
        user_id: targetId,
        type: "new_follower",
        title: "New Connection Request",
        body: `${requester?.display_name || "Someone"} sent you a connection request.`,
        data: { requester_id: requesterId },
        action_url: `/users/${requesterId}`,
      }); */
    } catch (err) {
      logger.warn("[ConnectionService] Failed to create request notification", {
        err,
      });
    }
  }

  private async notifyRequesterAccepted(
    requesterId: string,
    targetId: string,
  ): Promise<void> {
    try {
      const target = await User.findById(targetId).select("display_name");
      // TODO: Use platform-specific notification service
      /*      await Notification.create({
        user_id: requesterId,
        type: "follow_received",
        title: "Connection Request Accepted",
        body: `${target?.display_name || "Someone"} accepted your connection request.`,
        data: { target_id: targetId },
        action_url: `/users/${targetId}`,
      }); */
    } catch (err) {
      logger.warn(
        "[ConnectionService] Failed to create acceptance notification",
        {
          err,
        },
      );
    }
  }

  private async syncFeedFollowWithRetry(
    followerId: string,
    targetId: string,
    context: string,
  ): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= FEED_SYNC_RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        await feedService.follow(followerId, targetId);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < FEED_SYNC_RETRY_MAX_ATTEMPTS) {
          await this.sleep(FEED_SYNC_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        }
      }
    }

    logger.error("[ConnectionService] Feed follow sync failed after retries", {
      context,
      followerId,
      targetId,
      error: lastError,
    });

    throw new Error("Failed to sync connection feed state");
  }

  private async syncFeedUnfollowWithRetry(
    followerId: string,
    targetId: string,
    context: string,
  ): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= FEED_SYNC_RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        await feedService.unfollow(followerId, targetId);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < FEED_SYNC_RETRY_MAX_ATTEMPTS) {
          await this.sleep(FEED_SYNC_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        }
      }
    }

    logger.error(
      "[ConnectionService] Feed unfollow sync failed after retries",
      {
        context,
        followerId,
        targetId,
        error: lastError,
      },
    );

    throw new Error("Failed to sync disconnection feed state");
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const connectionService = new ConnectionService();
