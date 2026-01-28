import { Router } from "express";
import {
  marketplace_user_get,
  marketplace_user_inventory_get,
} from "../../handlers/userHandlers";
import { getUserInventorySchema } from "../../validation/schemas";
import { validateRequest } from "../../validation/middleware";

const router: Router = Router();

router.get("/", marketplace_user_get);
router.get(
  "/listings",
  validateRequest(getUserInventorySchema),
  marketplace_user_inventory_get
);

export { router as marketplaceUser };
