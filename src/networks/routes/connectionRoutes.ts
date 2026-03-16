// src/networks/routes/connectionRoutes.ts
import { Router } from "express";
import * as handlers from "../handlers/NetworksConnectionHandlers";
import { validateRequest } from "../../middleware/validation";
import {
  connectionRequestSchema,
  respondConnectionRequestSchema,
} from "../../validation/schemas";

const router = Router();

// ============================================================
// GET: Fetch pending connections and accepted connections
// ============================================================

/**
 * @swagger
 * /api/v1/networks/connections/my-incoming:
 *   get:
 *     summary: Get my pending incoming connection requests (awaiting my acceptance)
 *     tags: [Networks | Connections]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of pending incoming connection requests with requester info
 *       401:
 *         description: Unauthorized
 */
router.get("/my-incoming", handlers.networks_connection_incoming_pending);

/**
 * @swagger
 * /api/v1/networks/connections/my-outgoing:
 *   get:
 *     summary: Get my pending outgoing connection requests (awaiting response)
 *     tags: [Networks | Connections]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of pending outgoing connection requests
 *       401:
 *         description: Unauthorized
 */
router.get("/my-outgoing", handlers.networks_connection_outgoing_pending);

/**
 * @swagger
 * /api/v1/networks/connections:
 *   get:
 *     summary: Get my accepted connections
 *     tags: [Networks | Connections]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of accepted connections
 */
router.get("/", handlers.networks_connections_get);

// ============================================================
// POST: Send, Accept, Reject connection requests
// ============================================================

/**
 * @swagger
 * /api/v1/networks/connections/send-request:
 *   post:
 *     summary: Send a connection request to a user
 *     tags: [Networks | Connections]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               target_user_id:
 *                 type: string
 */
router.post(
  "/send-request",
  validateRequest(connectionRequestSchema),
  handlers.networks_connection_request_create,
);

/**
 * @swagger
 * /api/v1/networks/connections/{id}/accept:
 *   post:
 *     summary: Accept an incoming connection request
 *     tags: [Networks | Connections]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Connection request ID
 *     responses:
 *       200:
 *         description: Connection request accepted
 *       400:
 *         description: Invalid request or unauthorized
 *       404:
 *         description: Connection request not found
 */
router.post(
  "/:id/accept",
  handlers.networks_connection_request_respond,
);

/**
 * @swagger
 * /api/v1/networks/connections/{id}/reject:
 *   post:
 *     summary: Reject an incoming connection request
 *     tags: [Networks | Connections]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Connection request ID
 *     responses:
 *       200:
 *         description: Connection request rejected
 *       400:
 *         description: Invalid request or unauthorized
 *       404:
 *         description: Connection request not found
 */
router.post(
  "/:id/reject",
  handlers.networks_connection_request_respond,
);

// ============================================================
// DELETE: Remove connection
// ============================================================

/**
 * @swagger
 * /api/v1/networks/connections/{id}:
 *   delete:
 *     summary: Remove an accepted connection (unfollow)
 *     tags: [Networks | Connections]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to unfollow
 *     responses:
 *       200:
 *         description: Connection removed successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Connection not found
 */
router.delete("/:id", handlers.networks_connections_remove);

export default router;
