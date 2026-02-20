import { Router } from "express";
import * as chatHandlers from "../../handlers/chatHandlers";

const router = Router();

router.get("/token", chatHandlers.generateToken("networks"));
router.get("/channels", chatHandlers.getUserChannels("networks"));
router.get("/unread", chatHandlers.getUnreadCounts("networks"));
router.post("/channel", chatHandlers.getOrCreateChannel("networks"));

export { router as networksChatRoutes };
