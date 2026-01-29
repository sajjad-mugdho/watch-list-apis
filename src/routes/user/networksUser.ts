import { Router } from "express";
import {
  networks_user_get,
  networks_user_inventory_get,
} from "../../handlers/userHandlers";
import {
  getUserInventorySchema,
  getUserChannelsSchema,
} from "../../validation/schemas";
import { validateRequest } from "../../middleware/validation";
import { networks_user_offers_get } from "../../handlers/networksOfferHandlers";

const router: Router = Router();

router.get("/", networks_user_get);
router.get(
  "/listings",
  validateRequest(getUserInventorySchema),
  networks_user_inventory_get
);
router.get(
  "/offers",
  validateRequest(getUserChannelsSchema),
  networks_user_offers_get as any
);

export { router as networksUser };
