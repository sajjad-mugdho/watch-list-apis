import { Router } from "express";
import {
  requireCompletedOnboarding,
  requirePlatformAuth,
} from "../middleware/authentication";

import * as orderHandlers from "../handlers/orderHandlers";

const router = Router();

// All routes require authentication
router.use(requirePlatformAuth());
router.use(requireCompletedOnboarding());

/**
 * REFUND REQUESTS MANAGEMENT
 * Buyer Request / Seller Approval Flow:
 * 1. BUYER requests a refund with reason (via order endpoint)
 * 2. BUYER submits product return tracking info
 * 3. SELLER confirms product return received
 * 4. SELLER approves the refund
 * 5. BUYER receives the refund
 */

/**
 * GET /api/v1/marketplace/refund-requests
 * List refund requests for authenticated user (as buyer or seller)
 * Query params:
 *   - status: pending | return_requested | return_received | approved | denied | executed | cancelled
 *   - role: buyer | seller
 */
router.get("/", orderHandlers.getRefundRequests);

/**
 * GET /api/v1/marketplace/refund-requests/:id
 * Get single refund request details
 */
router.get("/:id", orderHandlers.getRefundRequest);

/**
 * POST /api/v1/marketplace/refund-requests/:id/submit-return
 * Buyer submits product return tracking information
 * Body: { tracking_number?: string, return_notes?: string }
 */
router.post("/:id/submit-return", orderHandlers.submitProductReturn);

/**
 * POST /api/v1/marketplace/refund-requests/:id/confirm-return
 * Seller confirms product has been received back
 * Body: { confirmation_notes?: string }
 */
router.post("/:id/confirm-return", orderHandlers.confirmProductReturn);

/**
 * POST /api/v1/marketplace/refund-requests/:id/approve
 * Seller approves a refund request - executes the refund
 * (Requires product return to be confirmed first)
 * Body: { approval_notes?: string }
 */
router.post("/:id/approve", orderHandlers.approveRefundRequest);

/**
 * POST /api/v1/marketplace/refund-requests/:id/deny
 * Seller denies a refund request
 * Body: { reason: string } (required, min 10 chars)
 */
router.post("/:id/deny", orderHandlers.denyRefundRequest);

/**
 * POST /api/v1/marketplace/refund-requests/:id/cancel
 * Buyer cancels their own pending refund request
 */
router.post("/:id/cancel", orderHandlers.cancelRefundRequest);

export { router as refundRequestRoutes };
