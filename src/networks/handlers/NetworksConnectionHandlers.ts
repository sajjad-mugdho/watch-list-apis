// src/networks/handlers/NetworksConnectionHandlers.ts
import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import {
  MissingUserContextError,
  ValidationError,
  NotFoundError,
} from "../../utils/errors";
import { connectionService } from "../../services/connection/ConnectionService";
import { ConnectionRequestInput } from "../../validation/schemas";
import { connectionRepository } from "../../repositories/ConnectionRepository";
import { User } from "../../models/User";
import { Connection } from "../models/Connection";
import logger from "../../utils/logger";

// ============================================================
// Input Validation Helpers
// ============================================================

const MAX_PAGE_SIZE = 100;

const parsePositiveInt = (
  value: unknown,
  fallback: number,
  max: number,
): number => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const parseNonNegativeInt = (value: unknown): number => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const getAcceptedPeerIds = async (userId: string): Promise<string[]> => {
  const connections = await Connection.find({
    status: "accepted",
    $or: [{ follower_id: userId }, { following_id: userId }],
  })
    .select("follower_id following_id")
    .lean();

  return connections.map((c: any) => {
    const followerId = String(c.follower_id);
    const followingId = String(c.following_id);
    return followerId === userId ? followingId : followerId;
  });
};

/**
 * Get pending incoming connection requests (people who want to connect with me).
 * GET /api/v1/networks/connections/my-incoming
 * Returns connection requests with populated requester user info for UI display.
 */
export const networks_connection_incoming_pending = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = String((req as any).user.dialist_id);

    const limit = parsePositiveInt(req.query.limit, 20, MAX_PAGE_SIZE);
    const offset = parseNonNegativeInt(req.query.offset);

    const result = await connectionRepository.getIncomingPending(userId, {
      limit,
      offset,
    });

    const currentUserPeerSet = new Set(await getAcceptedPeerIds(userId));

    // Enhance response with requester user info for UI display
    const enrichedData = await Promise.all(
      result.data.map(async (connection: any) => {
        const requesterId = String(connection.follower_id);
        const requester = await User.findById(connection.follower_id).select(
          "display_name avatar bio",
        );

        const requesterPeerIds = await getAcceptedPeerIds(requesterId);
        const mutualFriendsCount = requesterPeerIds.filter((peerId) =>
          currentUserPeerSet.has(peerId),
        ).length;

        const handle = requester?.display_name
          ? `@${String(requester.display_name).replace(/^@+/, "")}`
          : null;

        return {
          id: connection._id?.toString(),
          requester: {
            user_id: requesterId,
            display_name: requester?.display_name || "Unknown User",
            handle,
            avatar: requester?.avatar || null,
            bio: requester?.bio || null,
            mutual_friends_count: mutualFriendsCount,
          },
          status: connection.status,
          created_at: connection.createdAt,
        };
      }),
    );

    res.status(200).json({
      data: enrichedData,
      _metadata: {
        paging: {
          count: enrichedData.length,
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.hasMore,
        },
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    if (err instanceof MissingUserContextError) {
      next(err);
    } else {
      next(err);
    }
  }
};

/**
 * Get pending outgoing connection requests (people I asked to connect with).
 * GET /api/v1/networks/connections/my-outgoing
 */
export const networks_connection_outgoing_pending = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = String((req as any).user.dialist_id);

    const limit = parsePositiveInt(req.query.limit, 20, MAX_PAGE_SIZE);
    const offset = parseNonNegativeInt(req.query.offset);

    const result = await connectionRepository.getOutgoingPending(userId, {
      limit,
      offset,
    });

    res.status(200).json({
      data: result.data,
      _metadata: {
        paging: {
          count: result.data.length,
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.hasMore,
        },
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    if (err instanceof MissingUserContextError) {
      next(err);
    } else {
      next(err);
    }
  }
};

/**
 * POST /api/v1/networks/connections/send-request
 */
export const networks_connection_request_create = async (
  req: Request<{}, {}, ConnectionRequestInput["body"]>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const followerId = String((req as any).user.dialist_id);
    const { target_user_id } = req.body;

    const result = await connectionService.requestConnection(
      followerId,
      target_user_id,
    );

    res.status(201).json({
      data: result,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      next(err);
    } else if (err instanceof MissingUserContextError) {
      next(err);
    } else {
      next(err);
    }
  }
};

/**
 * Respond to a connection request (accept/reject)
 * POST /api/v1/networks/connections/:id/accept or /:id/reject
 * Route path determines action (accept vs reject)
 */
export const networks_connection_request_respond = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = String((req as any).user.dialist_id);
    const { id: connectionId } = req.params;

    // Determine action from route path, not body
    const route = req.route.path;
    const isAccept = route.includes("/accept");
    const isReject = route.includes("/reject");

    if (!isAccept && !isReject) {
      throw new Error("Invalid route - must be /accept or /reject");
    }

    let result;
    if (isAccept) {
      result = await connectionService.acceptConnectionRequest(
        userId,
        connectionId,
      );

      // Invalidate cache for both users
      try {
        const { networksHomeFeedService } =
          await import("../services/NetworksHomeFeedService");
        await networksHomeFeedService.invalidateUserCache(userId);
        if (result?.follower_id) {
          await networksHomeFeedService.invalidateUserCache(
            String(result.follower_id),
          );
        }
      } catch (cacheError) {
        logger.warn("Failed to invalidate connection cache", { cacheError });
      }
    } else if (isReject) {
      await connectionService.rejectConnectionRequest(userId, connectionId);
      result = { message: "Connection request rejected" };
    }

    res.json({
      data: result,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    if (
      err instanceof MissingUserContextError ||
      err instanceof NotFoundError ||
      err instanceof ValidationError
    ) {
      next(err);
    } else {
      next(new ValidationError(err?.message ?? "Unknown error"));
    }
  }
};

/**
 * Get accepted outgoing connections for current user.
 * GET /api/v1/networks/connections
 */
export const networks_connections_get = async (
  req: Request,
  res: Response<ApiResponse<any[]>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = String((req as any).user.dialist_id);

    const page = parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInt(req.query.limit, 50, MAX_PAGE_SIZE);
    const offset = (page - 1) * limit;

    const { connections, total } =
      await connectionService.getOutgoingConnections(userId, {
        limit,
        offset,
      });

    res.json({
      data: connections,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        paging: {
          count: connections.length,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Remove an accepted connection (unfollow)
 * DELETE /api/v1/networks/connections/:id
 * :id is the user ID to unfollow, removing the connection.
 */
export const networks_connections_remove = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = String((req as any).user.dialist_id);
    const { id: targetUserId } = req.params;

    await connectionService.removeConnection(userId, targetUserId);

    res.json({
      data: { message: "Connection removed successfully" },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    next(new ValidationError(err.message));
  }
};
