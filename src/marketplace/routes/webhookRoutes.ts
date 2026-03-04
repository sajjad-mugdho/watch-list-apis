import { Router } from "express";
import { webhook_finix_post } from "../handlers/MarketplaceWebhookHandlers";

const router = Router();
router.post("/finix", webhook_finix_post);

export { router as marketplaceWebhookRoutes };
