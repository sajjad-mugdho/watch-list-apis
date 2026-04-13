// src/routes/user/webhooksRoutes.ts
import { Router } from "express";
import { webhook_clerk_post } from "../handlers/webhookHandlers";
import { handlePersonaWebhook } from "../handlers/personaWebhookHandler";
import chatWebhookRoutes from "../networks/routes/webhookRoutes";

const router: Router = Router();

router.post("/clerk", webhook_clerk_post);
router.post("/persona", handlePersonaWebhook);
router.use("/chat", chatWebhookRoutes);

export { router as webhooksRoutes };
