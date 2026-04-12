import { Router } from "express";
import * as chatHandlers from "../handlers/NetworksChatHandlers";

const router = Router();

router.get("/token", chatHandlers.generateToken);
router.get("/channels", chatHandlers.getUserChannels);
router.get("/unread", chatHandlers.getUnreadCounts);
router.post("/channel", chatHandlers.getOrCreateChannel);
router.post("/channel/mark-read", chatHandlers.markChannelAsRead);

export default router;
