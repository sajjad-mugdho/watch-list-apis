import { Router } from "express";
import {
  marketplace_merchant_onboard_post,
  marketplace_merchant_status_get,
  marketplace_merchant_refresh_link_post,
} from "../handlers/MarketplaceMerchantHandlers";
import { validateRequest } from "../../middleware/validation";
import {
  MerchantOnboardSchema,
  merchantRefreshLinkSchema,
} from "../../validation/schemas";

const router: Router = Router();

// Create Finix onboarding session
router.post(
  "/onboard",
  validateRequest(MerchantOnboardSchema),
  marketplace_merchant_onboard_post as any
);

// Get merchant status
router.get("/status", marketplace_merchant_status_get as any);

// Refresh expired form link
router.post(
  "/onboard/refresh-link",
  validateRequest(merchantRefreshLinkSchema),
  marketplace_merchant_refresh_link_post as any
);

export default router;
