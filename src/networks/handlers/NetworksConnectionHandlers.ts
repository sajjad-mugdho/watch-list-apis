// src/networks/handlers/NetworksConnectionHandlers.ts
import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import { MissingUserContextError, ValidationError } from "../../utils/errors";
import { friendshipService } from "../../services/friendship/FriendshipService";
import {
  FriendRequestInput,
  RespondFriendRequestInput,
} from "../../validation/schemas";
import { feedService } from "../../services/FeedService";

/**
 * Send a friend request
 * POST /api/v1/networks/connections/request
 */
export const networks_friend_request_send = async (
  req: Request<{}, {}, FriendRequestInput["body"]>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const requester_id = (req as any).user.dialist_id;
    const { target_user_id } = req.body;

    const result = await friendshipService.sendRequest({
      requester_id: String(requester_id),
      addressee_id: target_user_id,
    });

    res.status(201).json({
      data: result,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    next(new ValidationError(err.message));
  }
};

/**
 * Respond to a friend request
 * PATCH /api/v1/networks/connections/:id/respond
 */
export const networks_friend_request_respond = async (
  req: Request<
    RespondFriendRequestInput["params"],
    {},
    RespondFriendRequestInput["body"]
  >,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id: friendshipId } = req.params;
    const { status } = req.body;

    let result;
    if (status === "accepted") {
      result = await friendshipService.acceptRequest(
        friendshipId,
        String(userId),
      );
    } else {
      await friendshipService.declineRequest(friendshipId, String(userId));
      result = { message: "Request declined" };
    }

    res.json({
      data: result,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    next(new ValidationError(err.message));
  }
};

/**
 * Get user connections (friends)
 * GET /api/v1/networks/connections
 */
export const networks_connections_get = async (
  req: Request,
  res: Response<ApiResponse<any[]>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const { friends, total } = await friendshipService.getFriends(
      String(userId),
      {
        limit,
        offset,
      },
    );

    res.json({
      data: friends,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        paging: {
          count: friends.length,
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
 * Get listings from followed users (timeline feed)
 * GET /api/v1/networks/connections/listings
 */
export const networks_connections_listings_get = async (
  req: Request,
  res: Response<ApiResponse<any[]>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const activities = await feedService.getTimeline(
      String(userId),
      limit,
      offset,
    );

    // Filter for listing activities specifically if needed,
    // or return the whole timeline as requested by the spec
    res.json({
      data: activities,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        paging: {
          count: activities.length,
          total: activities.length,
          limit,
          offset,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
