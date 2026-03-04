import { Router } from "express";
import * as conversationHandlers from "../handlers/MarketplaceConversationHandlers";

const router = Router();

router.get("/", conversationHandlers.getConversations("marketplace") as any);
router.get("/search", conversationHandlers.searchConversations("marketplace") as any);
router.get("/:id", conversationHandlers.getConversationContext("marketplace") as any);
router.get("/:id/media", conversationHandlers.getConversationMedia("marketplace") as any);

export default router;
