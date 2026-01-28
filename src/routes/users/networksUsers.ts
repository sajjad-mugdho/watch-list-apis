// src/routes/user/networksUser.ts

import { Router } from "express";
import { validateRequest } from "../../validation/middleware";
import { networks_user_public_get } from "../../handlers/usersHandlers";
import { getUserPublicProfileSchema } from "../../validation/schemas";

const router: Router = Router();

router.get(
  "/:id",
  validateRequest(getUserPublicProfileSchema),
  networks_user_public_get
);

export { router as networksPublicUsers };
