import { Router } from "express";
import {
  networks_order_get,
  networks_user_orders_get,
  networks_order_complete,
  networks_order_completion_status_get,
  networks_order_reference_check_initiate,
  networks_order_audit_trail_get,
} from "../handlers/NetworksOrderHandlers";
import { validateRequest } from "../../middleware/validation";
import { z } from "zod";

const router = Router();

// Validation Schemas
const orderIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

const getOrdersQuerySchema = z.object({
  query: z.object({
    type: z.enum(["buy", "sell"]).optional(),
    status: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  }),
});

/**
 * GET /api/v1/networks/orders
 */
router.get(
  "/",
  validateRequest(getOrdersQuerySchema),
  networks_user_orders_get as any,
);

/**
 * GET /api/v1/networks/orders/:id
 */
router.get(
  "/:id",
  validateRequest(orderIdParamSchema),
  networks_order_get as any,
);

/**
 * @swagger
 * /api/v1/networks/orders/{id}/complete:
 *   post:
 *     summary: Confirm order completion (dual-confirmation)
 *     description: >
 *       Both the buyer AND the seller must call this endpoint independently.
 *       The order transitions to "completed" only after both parties confirm.
 *       If an active reference check exists on the order it will also be
 *       completed as a side effect once both parties have confirmed.
 *     tags: [Networks - Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: >
 *           Confirmation recorded. Returns updated order.
 *           If both parties have confirmed, status will be "completed".
 *       400:
 *         description: Already confirmed, or order is not in a confirmable status.
 *       403:
 *         description: Caller is not the buyer or seller on this order.
 *       404:
 *         description: Order not found.
 */
router.post(
  "/:id/complete",
  validateRequest(orderIdParamSchema),
  networks_order_complete as any,
);

/**
 * GET /api/v1/networks/orders/:id/completion-status
 */
router.get(
  "/:id/completion-status",
  validateRequest(orderIdParamSchema),
  networks_order_completion_status_get as any,
);

/**
 * POST /api/v1/networks/orders/:id/reference-check/initiate
 */
router.post(
  "/:id/reference-check/initiate",
  validateRequest(orderIdParamSchema),
  networks_order_reference_check_initiate as any,
);

/**
 * GET /api/v1/networks/orders/:id/audit-trail
 */
router.get(
  "/:id/audit-trail",
  validateRequest(orderIdParamSchema),
  networks_order_audit_trail_get as any,
);

export default router;
