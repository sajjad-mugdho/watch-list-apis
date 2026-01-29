import { Router } from "express";
import {
  networks_listing_create,
  networks_listings_get,
  networks_listing_update,
  networks_listing_publish,
} from "../../handlers/networksListingHandlers";
import {
  networks_listing_offers_get,
  networks_offer_send,
} from "../../handlers/networksOfferHandlers";
import { networks_listing_inquire } from "../../handlers/inquiryHandlers";
import { validateRequest } from "../../middleware/validation";
import {
  createListingSchema,
  updateListingSchema,
  publishListingSchema,
  sendOfferSchema,
  getListingChannelsSchema,
  getListingsSchema,
} from "../../validation/schemas";

const router: Router = Router();

router.get(
  "/",
  validateRequest(getListingsSchema),
  networks_listings_get as any
);
router.post("/", validateRequest(createListingSchema), networks_listing_create);
router.patch(
  "/:id",
  validateRequest(updateListingSchema),
  networks_listing_update
);
router.post(
  "/:id/publish",
  validateRequest(publishListingSchema),
  networks_listing_publish
);

router.post(
  "/:id/offers",
  validateRequest(sendOfferSchema),
  networks_offer_send
);
router.get(
  "/:id/offers",
  validateRequest(getListingChannelsSchema),
  networks_listing_offers_get
);

// Inquiry - creates channel immediately (user-to-user unique)
router.post("/:id/inquire", networks_listing_inquire);

export { router as networksListings };
