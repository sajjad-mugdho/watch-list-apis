import { Router } from "express";
import {
  networks_user_get,
  networks_user_inventory_get,
  networks_user_public_profile_get,
  networks_user_listings_get,
  networks_user_block,
  networks_user_report,
  networks_user_blocks_get,
  networks_user_unblock,
  networks_user_references_get,
} from "../handlers/NetworksUserHandlers";
import { networks_dashboard_stats_get } from "../handlers/NetworksDashboardHandlers";
import { social_common_groups_get } from "../handlers/SocialHubHandlers";
import {
  getUserInventorySchema,
  getUserPublicProfileSchema,
  blockUserSchema,
  createReportSchema,
} from "../../validation/schemas";
import { validateRequest } from "../../middleware/validation";

const router = Router();

router.get("/", networks_user_get as any);
router.get(
  "/listings",
  validateRequest(getUserInventorySchema),
  networks_user_inventory_get as any,
);
router.get("/dashboard/stats", networks_dashboard_stats_get as any);

router.get(
  "/:id/profile",
  validateRequest(getUserPublicProfileSchema),
  networks_user_public_profile_get as any,
);

router.get(
  "/:id/listings",
  validateRequest(getUserPublicProfileSchema),
  networks_user_listings_get as any,
);

router.post(
  "/block",
  validateRequest(blockUserSchema),
  networks_user_block as any,
);

router.get("/blocks", networks_user_blocks_get as any);

router.delete("/blocks/:blocked_id", networks_user_unblock as any);

router.post(
  "/report",
  validateRequest(createReportSchema),
  networks_user_report as any,
);

router.get("/:id/common-groups", social_common_groups_get as any);
router.get("/:id/references", networks_user_references_get as any);

export default router;
