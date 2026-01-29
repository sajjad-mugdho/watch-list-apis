// src/routes/user/onboardingRoutes.ts
import { Router } from "express";
import { validateRequest } from "../middleware/validation";
import {
  onboarding_acknowledgements_patch,
  onboarding_avatar_patch,
  onboarding_display_name_patch,
  onboarding_location_patch,
  onboarding_status_get,
} from "../handlers/onboardingHandlers";
import {
  getOnboardingStatusSchema,
  patchLocationStepSchema,
  patchDisplayNameStepSchema,
  patchAvatarStepSchema,
  patchAcksStepSchema,
} from "../validation/schemas";

const router: Router = Router();

router.get(
  "/status",
  validateRequest(getOnboardingStatusSchema),
  onboarding_status_get
);
router.patch(
  "/steps/location",
  validateRequest(patchLocationStepSchema),
  onboarding_location_patch
);
router.patch(
  "/steps/display_name",
  validateRequest(patchDisplayNameStepSchema),
  onboarding_display_name_patch
);
router.patch(
  "/steps/avatar",
  validateRequest(patchAvatarStepSchema),
  onboarding_avatar_patch
);
router.patch(
  "/steps/acknowledgements",
  validateRequest(patchAcksStepSchema),
  onboarding_acknowledgements_patch
);

export { router as onboardingRoutes };
