import { Router } from "express";
import {
  networks_listing_create,
  networks_listings_get,
  networks_listing_update,
  networks_listing_publish,
  networks_listing_status_patch,
  networks_listing_delete,
  networks_listing_preview,
  networks_listing_get,
} from "../handlers/NetworksListingHandlers";
import { networks_concierge_request_create } from "../handlers/NetworksConciergeHandlers";
import {
  networks_listing_offers_get,
  networks_offer_send,
} from "../handlers/NetworksOfferHandlers";
import { networks_listing_inquire } from "../handlers/NetworksInquiryHandlers";
import { validateRequest } from "../../middleware/validation";
import {
  createListingSchema,
  updateListingSchema,
  publishListingSchema,
  sendOfferSchema,
  getListingChannelsSchema,
  getListingsSchema,
  updateListingStatusSchema,
  deleteListingSchema,
  conciergeRequestSchema,
} from "../../validation/schemas";

const router: Router = Router();

router.get(
  "/",
  validateRequest(getListingsSchema),
  networks_listings_get as any
);
router.get("/:id", networks_listing_get as any);
router.post("/", validateRequest(createListingSchema), networks_listing_create as any);
router.patch(
  "/:id",
  validateRequest(updateListingSchema),
  networks_listing_update as any
);
router.post(
  "/:id/publish",
  validateRequest(publishListingSchema),
  networks_listing_publish as any
);
router.patch(
  "/:id/status",
  validateRequest(updateListingStatusSchema),
  networks_listing_status_patch as any
);
router.delete(
  "/:id",
  validateRequest(deleteListingSchema),
  networks_listing_delete as any
);

router.get(
  "/:id/preview",
  networks_listing_preview as any // Author-only preview
);

router.post(
  "/:id/concierge",
  validateRequest(conciergeRequestSchema),
  networks_concierge_request_create as any
);

router.post(
  "/:id/offers",
  validateRequest(sendOfferSchema),
  networks_offer_send as any
);
router.get(
  "/:id/offers",
  validateRequest(getListingChannelsSchema),
  networks_listing_offers_get as any
);

// Inquiry - creates channel immediately (user-to-user unique)
router.post("/:id/inquire", networks_listing_inquire as any);

export default router;
