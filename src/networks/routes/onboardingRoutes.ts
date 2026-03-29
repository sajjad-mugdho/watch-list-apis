import { Router } from "express";
import { validateRequest } from "../../middleware/validation";
import { completeOnboardingSchema } from "../../validation/schemas";
import {
  networks_onboarding_status_get,
  networks_onboarding_complete_patch,
} from "../handlers/onboardingHandlers";

const router: Router = Router();

/**
 * Get onboarding status for authenticated user
 * GET /api/v1/networks/onboarding/status
 *
 * Returns: status ("incomplete"|"completed"), steps progress, user info
 * Auth: Required (Clerk JWT)
 */
router.get("/status", networks_onboarding_status_get as any);

/**
 * Complete onboarding atomically with all fields at once
 * PATCH /api/v1/networks/onboarding/complete
 *
 * Request body must include:
 * - location: { country, region, currency, postal_code?, city?, line1?, line2? }
 * - profile: { first_name, last_name }
 * - avatar: { type: 'monogram'|'upload', fields vary by type }
 */
router.patch(
  "/complete",
  validateRequest(completeOnboardingSchema),
  networks_onboarding_complete_patch as any,
);

export default router;
