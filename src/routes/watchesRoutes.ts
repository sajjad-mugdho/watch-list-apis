import { Router } from "express";
import { validateRequest } from "../validation/middleware";
import { getWatchesSchema } from "../validation/schemas";
import { watches_list_get } from "../handlers/watchesHandlers";

const router: Router = Router();

router.get("/", validateRequest(getWatchesSchema), watches_list_get);

export { router as watchesRoutes };
