import { Router } from "express";
import {
  networks_order_get,
  networks_user_orders_get
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
  networks_user_orders_get as any
);

/**
 * GET /api/v1/networks/orders/:id
 */
router.get(
  "/:id",
  validateRequest(orderIdParamSchema),
  networks_order_get as any
);

export default router;
