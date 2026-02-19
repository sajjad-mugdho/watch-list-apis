import { Router } from "express";
import * as chatHandlers from "../../handlers/chatHandlers";

const router = Router();

router.get("/token", chatHandlers.generateToken("marketplace"));
router.get("/channels", chatHandlers.getUserChannels("marketplace"));
router.get("/unread", chatHandlers.getUnreadCounts("marketplace"));
router.post("/channel", chatHandlers.getOrCreateChannel("marketplace"));

export { router as marketplaceChatRoutes };
