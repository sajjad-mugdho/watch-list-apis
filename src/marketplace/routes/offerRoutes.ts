import { Router } from "express";
import {
  marketplace_user_offers_get,
  marketplace_offer_get,
  marketplace_offer_accept,
  marketplace_offer_reject,
  marketplace_offer_counter,
  marketplace_offer_checkout,
} from "../handlers/MarketplaceOfferHandlers";
import { validateRequest } from "../../middleware/validation";
import { z } from "zod";

const router = Router();

// Validation Schemas
const offerIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

const counterOfferSchema = z.object({
  params: z.object({
    id: z.string().min(1),
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
 * GET /api/v1/marketplace/offers
 */
router.get(
  "/",
  validateRequest(getOffersSchema),
  marketplace_user_offers_get as any
);

/**
 * GET /api/v1/marketplace/offers/:id
 */
router.get(
  "/:id",
  validateRequest(offerIdParamSchema),
  marketplace_offer_get as any
);

/**
 * POST /api/v1/marketplace/offers/:id/accept
 */
router.post(
  "/:id/accept",
  validateRequest(offerIdParamSchema),
  marketplace_offer_accept as any
);

/**
 * POST /api/v1/marketplace/offers/:id/reject
 */
router.post(
  "/:id/reject",
  validateRequest(offerIdParamSchema),
  marketplace_offer_reject as any
);

/**
 * POST /api/v1/marketplace/offers/:id/counter
 */
router.post(
  "/:id/counter",
  validateRequest(counterOfferSchema),
  marketplace_offer_counter as any
);

/**
 * POST /api/v1/marketplace/offers/:id/checkout
 */
router.post(
  "/:id/checkout",
  validateRequest(offerIdParamSchema),
  marketplace_offer_checkout as any
);

export default router;
