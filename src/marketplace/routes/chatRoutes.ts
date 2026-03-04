import { Router } from "express";
import * as chatHandlers from "../handlers/MarketplaceChatHandlers";

const router = Router();

router.get("/token", chatHandlers.generateToken("marketplace") as any as any);
router.get("/channels", chatHandlers.getUserChannels("marketplace") as any as any);
router.get("/unread", chatHandlers.getUnreadCounts("marketplace") as any as any);
router.post("/channel", chatHandlers.getOrCreateChannel("marketplace") as any as any);

export default router;
