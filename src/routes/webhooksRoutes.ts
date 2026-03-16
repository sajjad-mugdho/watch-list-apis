// src/routes/user/webhooksRoutes.ts
import { Router } from "express";
import { webhook_clerk_post } from "../handlers/webhookHandlers";
import { handlePersonaWebhook } from "../handlers/personaWebhookHandler";

const router: Router = Router();

router.post("/clerk", webhook_clerk_post);
router.post("/persona", handlePersonaWebhook);

export { router as webhooksRoutes };
