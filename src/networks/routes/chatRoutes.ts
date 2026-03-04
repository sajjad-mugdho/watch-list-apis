import { Router } from "express";
import * as chatHandlers from "../handlers/NetworksChatHandlers";

const router = Router();

router.get("/token", chatHandlers.generateToken("networks") as any as any);
router.get("/channels", chatHandlers.getUserChannels("networks") as any as any);
router.get("/unread", chatHandlers.getUnreadCounts("networks") as any as any);
router.post("/channel", chatHandlers.getOrCreateChannel("networks") as any as any);

export default router;
