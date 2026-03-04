// src/routes/user/webhooksRoutes.ts
import { Router } from "express";
import { webhook_clerk_post } from "../handlers/webhookHandlers";

const router: Router = Router();

router.post("/clerk", webhook_clerk_post);


export { router as webhooksRoutes };
