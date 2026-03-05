import { Router } from "express";
import {
  requirePlatformAuth,
} from "../../middleware/authentication";

import * as orderHandlers from "../handlers/MarketplaceOrderHandlers";
import * as debugHandlers from "../../handlers/debugHandlers";
import { validateRequest } from "../../middleware/validation";
import {
  processPaymentSchema,
  getTokenizationSchema,
  reserveListingSchema,
  uploadTrackingSchema,
  requestRefundSchema,
  orderIdParamSchema,
  getOrderSchema,
} from "../../validation/schemas";

const router = Router();

// All routes require authentication
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

// Debug endpoint
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
 * REFUND WORKFLOW
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

export default router;
