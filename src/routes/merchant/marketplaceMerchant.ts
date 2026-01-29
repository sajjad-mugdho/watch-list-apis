import { Router } from "express";
import {
  marketplace_merchant_onboard_post,
  marketplace_merchant_status_get,
  marketplace_merchant_refresh_link_post,
} from "../../handlers/marketplaceMerchantHandlers";
import { validateRequest } from "../../middleware/validation";
import {
  MerchantOnboardSchema,
  merchantRefreshLinkSchema,
} from "../../validation/schemas";

const router: Router = Router();

// POST /api/v1/marketplace/merchant/onboard - Create Finix onboarding session
router.post(
  "/onboard",
  validateRequest(MerchantOnboardSchema),
  marketplace_merchant_onboard_post
);

// GET /api/v1/marketplace/merchant/status - Get merchant status
router.get("/status", marketplace_merchant_status_get);

// POST /api/v1/marketplace/merchant/onboard/refresh-link - Refresh expired form link
router.post(
  "/onboard/refresh-link",
  validateRequest(merchantRefreshLinkSchema),
  marketplace_merchant_refresh_link_post
);

export { router as marketplaceMerchantRoutes };
