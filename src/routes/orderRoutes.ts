import { Router } from "express";
import {
  requirePlatformAuth,
} from "../middleware/authentication";

import * as orderHandlers from "../handlers/orderHandlers";
import * as debugHandlers from "../handlers/debugHandlers";
import { validateRequest } from "../middleware/validation";
import {
  processPaymentSchema,
  getTokenizationSchema,
  reserveListingSchema,
  uploadTrackingSchema,
  requestRefundSchema,
  orderIdParamSchema,
  getOrderSchema,
} from "../validation/schemas";
const router = Router();

// All routes require authentications
router.use(requirePlatformAuth());
router.post(
  "/reserve",
  validateRequest(reserveListingSchema),
  orderHandlers.reserveListing
);
router.post(
  "/:id/tokenize",
  validateRequest(getTokenizationSchema),
  orderHandlers.getTokenizationForm
);
router.post(
  "/:id/payment",
  validateRequest(processPaymentSchema),
  orderHandlers.processPayment
);

// Debug endpoint - showcases the Finix payloads that would be sent without calling Finix
// Accessible only in non-production environments
router.get("/:id/finix-debug", debugHandlers.getFinixDebugPayloads);

/**
 * POST-PURCHASE
 */
router.post(
  "/:id/tracking",
  validateRequest(uploadTrackingSchema),
  orderHandlers.uploadTracking
);
router.post(
  "/:id/confirm-delivery",
  validateRequest(orderIdParamSchema),
  orderHandlers.confirmDelivery
);
router.post(
  "/:id/cancel",
  validateRequest(orderIdParamSchema),
  orderHandlers.cancelOrder
);

/**
 * REFUND WORKFLOW (Buyer-request / Seller-approval flow per Finix certification)
 */
router.post(
  "/:id/refund-request",
  validateRequest(requestRefundSchema),
  orderHandlers.requestRefund
);

/**
 * QUERIES
 */
router.get(
  "/:id",
  validateRequest(getOrderSchema),
  orderHandlers.getOrder
);
router.get(
  "/:id/dispute",
  validateRequest(orderIdParamSchema),
  orderHandlers.getOrderDispute
);
router.get("/buyer/list", orderHandlers.getBuyerOrders);
router.get("/seller/list", orderHandlers.getSellerOrders);

export { router as orderRoutes };
