import { Router } from "express";
import {
  marketplace_onboarding_status_get,
  marketplace_onboarding_complete_patch,
} from "../handlers/MarketplaceUserHandlers";
import { validateRequest } from "../../middleware/validation";
import { marketplaceOnboardingCompleteSchema } from "../../validation/schemas";

const router: Router = Router();

/**
 * GET /api/v1/marketplace/onboarding/status
 *
 * Get marketplace onboarding status and pre-populated data
 */
router.get("/status", marketplace_onboarding_status_get as any);

/**
 * PATCH /api/v1/marketplace/onboarding/complete
 *
 * Complete Marketplace onboarding atomically
 * Used by existing Networks users signing into Marketplace for the first time
 * or brand new Marketplace users
 */
router.patch(
  "/complete",
  validateRequest(marketplaceOnboardingCompleteSchema),
  marketplace_onboarding_complete_patch as any,
);

export default router;
