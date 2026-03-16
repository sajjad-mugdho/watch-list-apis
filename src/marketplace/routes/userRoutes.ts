import { Router } from "express";
import {
  marketplace_user_get,
  marketplace_user_inventory_get,
  marketplace_user_offers_get_handler,
} from "../handlers/MarketplaceUserHandlers";
import { getUserInventorySchema } from "../../validation/schemas";
import { validateRequest } from "../../middleware/validation";

const router: Router = Router();

router.get("/", marketplace_user_get as any);
router.get(
  "/listings",
  validateRequest(getUserInventorySchema),
  marketplace_user_inventory_get as any
);

router.get("/offers", marketplace_user_offers_get_handler as any);

export default router;
