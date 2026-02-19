import { Router } from "express";
import * as conversationHandlers from "../../handlers/conversationHandlers";

const router = Router();

router.get("/", conversationHandlers.getConversations("networks"));
router.get("/search", conversationHandlers.searchConversations("networks"));
router.get("/:id", conversationHandlers.getConversationContext("networks"));
router.get("/:id/media", conversationHandlers.getConversationMedia("networks"));

export { router as networksConversationRoutes };
