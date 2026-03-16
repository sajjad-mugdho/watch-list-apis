import { Router } from "express";
import {
  networks_user_offers_get,
  networks_offer_get,
  networks_offer_accept,
  networks_offer_reject,
  networks_offer_counter,
} from "../handlers/NetworksOfferHandlers";
import { validateRequest } from "../../middleware/validation";
import { z } from "zod";

const router = Router();

// Validation Schemas
const offerIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid channel ID"),
  }),
});

const counterOfferSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid channel ID"),
  }),
  body: z.object({
    amount: z.number().positive(),
    note: z.string().optional(),
  }),
});

const getOffersSchema = z.object({
  query: z.object({
    type: z.enum(["sent", "received"]).optional(),
    status: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  }),
});

/**
 * GET /api/v1/networks/offers
 */
router.get(
  "/",
  validateRequest(getOffersSchema),
  networks_user_offers_get as any
);

/**
 * GET /api/v1/networks/offers/:id
 */
router.get(
  "/:id",
  validateRequest(offerIdParamSchema),
  networks_offer_get as any
);

/**
 * POST /api/v1/networks/offers/:id/accept
 */
router.post(
  "/:id/accept",
  validateRequest(offerIdParamSchema),
  networks_offer_accept as any
);

/**
 * POST /api/v1/networks/offers/:id/reject
 */
router.post(
  "/:id/reject",
  validateRequest(offerIdParamSchema),
  networks_offer_reject as any
);

/**
 * POST /api/v1/networks/offers/:id/counter
 */
router.post(
  "/:id/counter",
  validateRequest(counterOfferSchema),
  networks_offer_counter as any
);

export default router;
