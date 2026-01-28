import { Router } from "express";
import {
  marketplace_listing_create,
  marketplace_listings_get,
  marketplace_listing_update,
  marketplace_listing_publish,
  marketplace_listing_get_by_id, // Imported
} from "../../handlers/marketplaceListingHandlers";
import {
  marketplace_listing_offers_get,
  marketplace_offer_send,
} from "../../handlers/marketplaceOfferHandlers";
import {
  uploadListingImages,
  deleteListingImage,
  setListingThumbnail,
  reorderListingImages,
} from "../../handlers/imageHandlers";
import { marketplace_listing_inquire } from "../../handlers/inquiryHandlers";
import { uploadMultiple } from "../../middleware/upload";
import { validateRequest } from "../../validation/middleware";
import {
  createListingSchema,
  updateListingSchema,
  publishListingSchema,
  getListingsSchema,
  sendOfferSchema,
  getListingChannelsSchema,
} from "../../validation/schemas";

const router: Router = Router();

// Listing CRUD
router.get(
  "/",
  validateRequest(getListingsSchema),
  marketplace_listings_get as any
);

/**
 * GET /api/v1/marketplace/listings/:id
 */
router.get("/:id", marketplace_listing_get_by_id);
router.post(
  "/",
  validateRequest(createListingSchema),
  marketplace_listing_create
);
router.patch(
  "/:id",
  validateRequest(updateListingSchema),
  marketplace_listing_update
);
router.post(
  "/:id/publish",
  validateRequest(publishListingSchema),
  marketplace_listing_publish
);

// Image Management
router.post("/:id/images", uploadMultiple, uploadListingImages);
router.delete("/:id/images/:imageKey", deleteListingImage);
router.patch("/:id/thumbnail", setListingThumbnail);
router.patch("/:id/images/reorder", reorderListingImages);

// Offer Management
router.post(
  "/:id/offers",
  validateRequest(sendOfferSchema),
  marketplace_offer_send
);
router.get(
  "/:id/offers",
  validateRequest(getListingChannelsSchema),
  marketplace_listing_offers_get
);

// Inquiry - creates channel immediately
router.post("/:id/inquire", marketplace_listing_inquire);

export { router as marketplaceListings };
