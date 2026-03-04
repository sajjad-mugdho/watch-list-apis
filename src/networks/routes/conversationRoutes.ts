import { Router } from "express";
import * as conversationHandlers from "../handlers/NetworksConversationHandlers";

const router = Router();

router.get("/", conversationHandlers.getConversations("networks") as any);
router.get("/search", conversationHandlers.searchConversations("networks") as any);
router.get("/:id", conversationHandlers.getConversationContext("networks") as any);
router.get("/:id/media", conversationHandlers.getConversationMedia("networks") as any);

export default router;
