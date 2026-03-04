// src/networks/routes/connectionRoutes.ts
import { Router } from "express";
import * as handlers from "../handlers/NetworksConnectionHandlers";
import { validateRequest } from "../../middleware/validateRequest";
import {
  friendRequestSchema,
  respondFriendRequestSchema,
} from "../../validation/schemas";

const router = Router();

/**
 * @swagger
 * /api/v1/networks/connections/request:
 *   post:
 *     summary: Send a friend request
 *     tags: [Networks | Connections]
 */
router.post(
  "/request",
  validateRequest(friendRequestSchema),
  handlers.networks_friend_request_send
);

/**
 * @swagger
 * /api/v1/networks/connections/{id}/respond:
 *   patch:
 *     summary: Respond to a friend request
 *     tags: [Networks | Connections]
 */
router.patch(
  "/:id/respond",
  validateRequest(respondFriendRequestSchema),
  handlers.networks_friend_request_respond
);

/**
 * @swagger
 * /api/v1/networks/connections:
 *   get:
 *     summary: Get user connections (friends)
 *     tags: [Networks | Connections]
 */
router.get("/", handlers.networks_connections_get);

/**
 * @swagger
 * /api/v1/networks/connections/listings:
 *   get:
 *     summary: Get listings from followed users
 *     tags: [Networks | Connections]
 */
router.get("/listings", handlers.networks_connections_listings_get);

export default router;
