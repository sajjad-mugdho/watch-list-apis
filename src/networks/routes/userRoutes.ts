import { Router } from "express";
import {
  networks_user_get,
  networks_user_inventory_get,
  networks_user_public_profile_get,
  networks_user_listings_get,
  networks_user_block,
  networks_user_report,
} from "../handlers/NetworksUserHandlers";
import {
  networks_dashboard_stats_get,
} from "../handlers/NetworksDashboardHandlers";
import {
  getUserInventorySchema,
  getUserPublicProfileSchema,
  blockUserSchema,
  createReportSchema,
} from "../../validation/schemas";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router();

router.get("/", networks_user_get as any);
router.get(
  "/listings",
  validateRequest(getUserInventorySchema),
  networks_user_inventory_get as any
);
router.get(
  "/:id/profile",
  validateRequest(getUserPublicProfileSchema),
  networks_user_public_profile_get as any
);

router.get(
  "/dashboard/stats",
  networks_dashboard_stats_get as any
);

router.get(
  "/:id/listings",
  validateRequest(getUserPublicProfileSchema),
  networks_user_listings_get as any
);

router.post(
  "/block",
  validateRequest(blockUserSchema),
  networks_user_block as any
);

router.post(
  "/report",
  validateRequest(createReportSchema),
  networks_user_report as any
);

export default router;
