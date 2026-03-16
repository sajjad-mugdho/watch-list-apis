// src/networks/handlers/NetworksConnectionHandlers.ts
import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import {
  MissingUserContextError,
  ValidationError,
  NotFoundError,
} from "../../utils/errors";
import { connectionService } from "../../services/connection/ConnectionService";
import {
  ConnectionRequestInput,
  RespondConnectionRequestInput,
} from "../../validation/schemas";
import { connectionRepository } from "../../repositories/ConnectionRepository";
import { User } from "../../models/User";

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

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await connectionRepository.getIncomingPending(userId, {
      limit,
      offset,
    });

    // Enhance response with requester user info for UI display
    const enrichedData = await Promise.all(
      result.data.map(async (connection: any) => {
        const requester = await User.findById(connection.follower_id).select(
          "display_name avatar bio",
        );
        return {
          id: connection._id?.toString(),
          requester: {
            user_id: connection.follower_id?.toString(),
            display_name: requester?.display_name || "Unknown User",
            avatar: requester?.avatar || null,
            bio: requester?.bio || null,
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

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

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
 * Route path determines action (accept vs reject), status body param used for logic branching
 */
export const networks_connection_request_respond = async (
  req: Request<
    RespondConnectionRequestInput["params"],
    {},
    RespondConnectionRequestInput["body"]
  >,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = String((req as any).user.dialist_id);
    const { id: connectionId } = req.params;
    const { status } = req.body;

    let result;
    if (status === "accepted") {
      result = await connectionService.acceptConnectionRequest(
        userId,
        connectionId,
      );
    } else {
      await connectionService.rejectConnectionRequest(userId, connectionId);
      result = { message: "Connection request rejected" };
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

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
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
