// src/routes/user/marketplacePublicUsers.ts

import { Router } from "express";
import { validateRequest } from "../../middleware/validation";
import { marketplace_user_public_get } from "../../handlers/usersHandlers";
import { getUserPublicProfileSchema } from "../../validation/schemas";

const router: Router = Router();

router.get(
  "/:id",
  validateRequest(getUserPublicProfileSchema),
  marketplace_user_public_get
);

export { router as marketplacePublicUsers };
