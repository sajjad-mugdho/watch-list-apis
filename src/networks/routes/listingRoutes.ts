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
import {
  networks_listing_upload_images,
  networks_listing_delete_image,
} from "../handlers/NetworksListingImageHandlers";
import { networks_concierge_request_create } from "../handlers/NetworksConciergeHandlers";
import {
  networks_listing_offers_get,
  networks_offer_send,
} from "../handlers/NetworksOfferHandlers";
import { networks_listing_inquire } from "../handlers/NetworksInquiryHandlers";
import { networks_reservation_create } from "../handlers/NetworksReservationHandlers";
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
  createReservationSchema,
} from "../../validation/schemas";
import { normalizeListingQuery } from "../middleware/normalizeListingQuery";
import { uploadMultiple } from "../../middleware/upload";

const router: Router = Router();

router.get(
  "/",
  normalizeListingQuery,
  validateRequest(getListingsSchema),
  networks_listings_get as any,
);
router.get("/:id", networks_listing_get as any);
router.post(
  "/",
  validateRequest(createListingSchema),
  networks_listing_create as any,
);
router.patch(
  "/:id",
  validateRequest(updateListingSchema),
  networks_listing_update as any,
);
router.post(
  "/:id/publish",
  validateRequest(publishListingSchema),
  networks_listing_publish as any,
);
router.patch(
  "/:id/status",
  validateRequest(updateListingStatusSchema),
  networks_listing_status_patch as any,
);
router.delete(
  "/:id",
  validateRequest(deleteListingSchema),
  networks_listing_delete as any,
);

router.get(
  "/:id/preview",
  networks_listing_preview as any, // Author-only preview
);

/**
 * Image upload for networks listings
 * @route POST /api/v1/networks/listings/:id/images
 * @auth Required
 * @body multipart/form-data with 'images' field
 */
router.post(
  "/:id/images",
  uploadMultiple,
  networks_listing_upload_images as any,
);

/**
 * Delete image from networks listing
 * @route DELETE /api/v1/networks/listings/:id/images/:imageKey
 * @auth Required
 */
router.delete("/:id/images/:imageKey", networks_listing_delete_image as any);

router.post(
  "/:id/concierge",
  validateRequest(conciergeRequestSchema),
  networks_concierge_request_create as any,
);

router.post(
  "/:id/offers",
  validateRequest(sendOfferSchema),
  networks_offer_send as any,
);
router.get(
  "/:id/offers",
  validateRequest(getListingChannelsSchema),
  networks_listing_offers_get as any,
);

// Inquiry - creates channel immediately (user-to-user unique)
router.post("/:id/inquire", networks_listing_inquire as any);

/**
 * @swagger
 * /api/v1/networks/listings/{id}/reserve:
 *   post:
 *     summary: Reserve a listing (Buy Now)
 *     description: >
 *       Direct purchase at asking price. Creates an Order with
 *       reservation_terms_snapshot copied from the listing.
 *       The listing must be in "active" status.
 *     tags: [Networks - Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shipping_region:
 *                 type: string
 *                 description: Buyer's shipping region (required if listing has shipping options)
 *               note:
 *                 type: string
 *                 description: Optional note to seller
 *     responses:
 *       201:
 *         description: Reservation created. Returns the new Order.
 *       409:
 *         description: Listing already reserved by another buyer.
 *       400:
 *         description: Invalid shipping_region or listing not available.
 */
router.post(
  "/:id/reserve",
  validateRequest(createReservationSchema),
  networks_reservation_create as any,
);

export default router;
