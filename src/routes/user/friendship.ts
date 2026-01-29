/**
 * Friendship Routes
 * 
 * Endpoints for managing two-way friendships
 * 
 * Mounted at: /api/v1/user (via user routes)
 */

import { Router, Request, Response, NextFunction } from "express";
import { getUserId } from "../../middleware/attachUser";
import { validateRequest } from "../../middleware/validation";
import {
  sendFriendRequestSchema,
  friendRequestActionSchema,
  getFriendsSchema,
  getMutualFriendsSchema,
} from "../../validation/schemas";
import { friendshipService } from "../../services/friendship/FriendshipService";
// Response helpers available: import { createdResponse, paginatedResponse, successResponse, actionResponse, errorResponse } from "../../utils/apiResponse";

const router = Router();

// ----------------------------------------------------------
// Friend Request Endpoints
// ----------------------------------------------------------

/**
 * @route POST /api/v1/user/friends/requests
 * @desc Send a friend request
 */
router.post(
  "/friends/requests",
  validateRequest(sendFriendRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requester_id = getUserId(req);
      const { user_id: addressee_id } = req.body;

      const friendship = await friendshipService.sendRequest({
        requester_id,
        addressee_id,
      });

      res.status(201).json({
        data: {
          friendship_id: friendship._id.toString(),
          status: friendship.status,
          addressee_id,
        },
        message: "Friend request sent",
      });
    } catch (err) {
      if (err instanceof Error) {
        if (
          err.message.includes("yourself") ||
          err.message.includes("already friends") ||
          err.message.includes("already pending") ||
          err.message.includes("not found")
        ) {
          res.status(400).json({
            error: {
              message: err.message,
              code: "BAD_REQUEST",
            },
          });
          return;
        }
      }
      next(err);
    }
  }
);

/**
 * @route GET /api/v1/user/friends/requests/pending
 * @desc Get pending friend requests received by current user
 */
router.get(
  "/friends/requests/pending",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const requests = await friendshipService.getPendingRequests(userId);

      res.json({
        data: requests,
        count: requests.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route POST /api/v1/user/friends/requests/:friendship_id/accept
 * @desc Accept a friend request
 */
router.post(
  "/friends/requests/:friendship_id/accept",
  validateRequest(friendRequestActionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { friendship_id } = req.params;

      const friendship = await friendshipService.acceptRequest(friendship_id, userId);

      res.json({
        data: {
          friendship_id: friendship._id.toString(),
          status: friendship.status,
          friend_id: friendship.requester_id.toString(),
        },
        message: "Friend request accepted",
      });
    } catch (err) {
      if (err instanceof Error) {
        if (
          err.message.includes("not found") ||
          err.message.includes("cannot accept") ||
          err.message.includes("Cannot accept")
        ) {
          res.status(400).json({
            error: {
              message: err.message,
              code: "BAD_REQUEST",
            },
          });
          return;
        }
      }
      next(err);
    }
  }
);

/**
 * @route POST /api/v1/user/friends/requests/:friendship_id/decline
 * @desc Decline a friend request
 */
router.post(
  "/friends/requests/:friendship_id/decline",
  validateRequest(friendRequestActionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { friendship_id } = req.params;

      await friendshipService.declineRequest(friendship_id, userId);

      res.json({
        message: "Friend request declined",
      });
    } catch (err) {
      if (err instanceof Error) {
        if (
          err.message.includes("not found") ||
          err.message.includes("cannot decline") ||
          err.message.includes("Cannot decline")
        ) {
          res.status(400).json({
            error: {
              message: err.message,
              code: "BAD_REQUEST",
            },
          });
          return;
        }
      }
      next(err);
    }
  }
);

// ----------------------------------------------------------
// Friends List Endpoints
// ----------------------------------------------------------

/**
 * @route GET /api/v1/user/friends
 * @desc Get current user's friends list
 */
router.get(
  "/friends",
  validateRequest(getFriendsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { limit = 50, offset = 0 } = req.query;

      const { friends, total } = await friendshipService.getFriends(userId, {
        limit: Number(limit),
        offset: Number(offset),
      });

      res.json({
        data: friends,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route DELETE /api/v1/user/friends/:friendship_id
 * @desc Remove a friend (unfriend)
 */
router.delete(
  "/friends/:friendship_id",
  validateRequest(friendRequestActionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { friendship_id } = req.params;

      await friendshipService.removeFriend(friendship_id, userId);

      res.json({
        message: "Friend removed",
      });
    } catch (err) {
      if (err instanceof Error) {
        if (
          err.message.includes("not found") ||
          err.message.includes("not part") ||
          err.message.includes("not currently")
        ) {
          res.status(400).json({
            error: {
              message: err.message,
              code: "BAD_REQUEST",
            },
          });
          return;
        }
      }
      next(err);
    }
  }
);

/**
 * @route GET /api/v1/user/friends/mutual/:user_id
 * @desc Get mutual friends between current user and another user
 */
router.get(
  "/friends/mutual/:user_id",
  validateRequest(getMutualFriendsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { user_id: otherUserId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const { friends, total } = await friendshipService.getMutualFriends(userId, otherUserId, {
        limit: Number(limit),
        offset: Number(offset),
      });

      res.json({
        data: friends,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export { router as userFriendshipRoutes };
