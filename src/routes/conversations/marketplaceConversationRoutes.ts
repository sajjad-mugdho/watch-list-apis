import { Router } from "express";
import * as conversationHandlers from "../../handlers/conversationHandlers";

const router = Router();

router.get("/", conversationHandlers.getConversations("marketplace"));
router.get("/search", conversationHandlers.searchConversations("marketplace"));
router.get("/:id", conversationHandlers.getConversationContext("marketplace"));
router.get("/:id/media", conversationHandlers.getConversationMedia("marketplace"));

export { router as marketplaceConversationRoutes };
