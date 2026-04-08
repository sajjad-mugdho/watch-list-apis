import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middleware/validation";
import { networks_user_offers_get } from "../handlers/NetworksOfferHandlers";

const router = Router();

const getOffersInquiriesSchema = z.object({
  query: z.object({
    type: z.enum(["sent", "received"]).optional(),
    status: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  }),
});

/**
 * GET /api/v1/networks/offers-inquiries
 * Alias route for Batch 4 Part 2 contract naming.
 */
router.get(
  "/",
  validateRequest(getOffersInquiriesSchema),
  networks_user_offers_get as any,
);

export default router;
